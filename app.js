const express = require('express');
const mssql = require('mssql');
const session = require('express-session');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

dotenv.config();

const app = express();
const port = 5000;

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// Database configuration
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Test database connection
mssql.connect(config, (err) => {
  if (err) {
    console.log('Error connecting to SQL Server:', err);
  } else {
    console.log('Connected to SQL Server');
  }
});

// Routes
app.get('/', (req, res) => {
  const error = req.query.error ? true : false;
  res.render('login', { error: error });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM Mst_Users WHERE LOWER(userName) = LOWER(@username)';

  new mssql.Request()
    .input('username', mssql.VarChar, username)
    .query(query, (err, result) => {
      if (err) {
        console.log('Error querying database:', err);
        return res.redirect('/?error=1');
      }

      if (result.recordset.length > 0) {
        const user = result.recordset[0];
        console.log('User found:', user);

        if (password === user.Password) {
          req.session.user = user; // Store user in session
          return res.redirect('/register'); // Redirect to the register page
        } else {
          console.log('Incorrect password');
          return res.redirect('/?error=1');
        }
      } else {
        console.log('User not found');
        return res.redirect('/?error=1');
      }
    });
});

// Route to render the registration page
app.get('/register', (req, res) => {
  
  const query = 'SELECT * FROM Mst_Salutation';

  new mssql.Request().query(query, (err, result) => {
    if (err) {
      console.log('Error fetching salutations:', err);
      return res.status(500).send('Internal Server Error');
    }

    res.render('register', { salutations: result.recordset, user: req.session.user });
  });
});

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed.'));
        }
    },
});

// Route to handle form submission from register.ejs
app.post('/register', upload.fields([{ name: 'trfFiles', maxCount: 10 }, { name: 'historyFiles', maxCount: 10 }]), (req, res) => {
    const registerData = req.body; // Data from register.ejs
    req.session.registerData = registerData; // Store in session
    console.log("Register Data:", registerData); // Log data for debugging
    res.redirect('/nextPage'); // Redirect to nextPage.ejs
});

// Route to render nextPage.ejs
app.get('/nextPage', async (req, res) => {
    try {
        const pool = await mssql.connect(config);

        // Fetch payment modes from Mst_Paymentmode
        const paymentModesQuery = 'SELECT PayModeID, PaymentMode FROM Mst_Paymentmode';
        const paymentModesResult = await pool.request().query(paymentModesQuery);

        const registerData = req.session.registerData || {}; // Retrieve data from session

        // Pass payment modes and register data to nextPage.ejs
        res.render('nextPage', { 
            registerData: registerData,
            paymentModes: paymentModesResult.recordset,
            user: req.session.user
        });
    } catch (err) {
        console.error('Error rendering next page:', err);
        res.status(500).send('Server Error');
    }
});

// Route to handle final form submission from nextPage.ejs
app.post('/submit', upload.fields([{ name: 'trfFiles', maxCount: 10 }, { name: 'historyFiles', maxCount: 10 }]), async (req, res) => {
    try {
        const nextPageData = req.body; // Data from nextPage.ejs
        const registerData = req.session.registerData || {}; // Retrieve data from session

        // Combine data from both forms
        const combinedData = { ...registerData, ...nextPageData };

        // Log the combined data to the console
        console.log('Combined Form Data:', combinedData);

        const pool = await mssql.connect(config);

        // Calculate total gross amount (including visiting charges)
        const totalGrossAmount = parseFloat(combinedData.grossAmount || 0) + parseFloat(combinedData.visitingCharges || 0);

        // Validate that discount does not exceed gross amount
        if (parseFloat(combinedData.discountAmount) > totalGrossAmount) {
            return res.status(400).json({ error: 'Discount amount cannot exceed gross amount.' });
        }

        // Calculate net amount
        const netAmount = totalGrossAmount - parseFloat(combinedData.discountAmount || 0);

        // Validate that paid amount does not exceed net amount
        if (parseFloat(combinedData.paidAmount) > netAmount) {
            return res.status(400).json({ error: 'Paid amount cannot exceed net amount.' });
        }

        // Calculate balance amount
        const balanceAmount = netAmount - parseFloat(combinedData.paidAmount || 0);

        // Insert patient details and fetch the generated PatientID
        const patientQuery = `
            INSERT INTO Mst_Patient (Title, PatientName, Gender, DOB, Age, EmailID, MobileNo) 
            OUTPUT INSERTED.PatientID
            VALUES (@salutation, @patientName, @gender, @dob, @age, @EmailID, @MobileNo)
        `;
        const patientResult = await pool.request()
            .input('salutation', mssql.NVarChar, combinedData.salutation)
            .input('patientName', mssql.NVarChar, combinedData.patientName)
            .input('gender', mssql.NVarChar, combinedData.gender)
            .input('dob', mssql.Date, combinedData.dob)
            .input('age', mssql.Int, combinedData.age)
            .input('EmailID', mssql.NVarChar, combinedData.email)
            .input('MobileNo', mssql.NVarChar, `${combinedData.countryCode}${combinedData.phone}`)
            .query(patientQuery);

        const patientID = patientResult.recordset[0].PatientID;
        console.log("Generated PatientID:", patientID);

        // Insert visit details with BalanceAmt
        const visitQuery = `
            INSERT INTO Visit (VisitCode, VisitDateTime, PatientID, CenterId, ReferedId, DoctorID, DiscountAmount, Gross, VisitingCharges, Net, PaymentMode, AmountPaid, BalanceAmt) 
            OUTPUT INSERTED.VisitID
            VALUES (@visitCode, @visitDateTime, @patientID, @centerId, @referedId, @doctorId, @discountAmount, @grossAmount, @visitingCharges, @netAmount, @paymentMode, @paidAmount, @balanceAmount)
        `;
        const visitResult = await pool.request()
            .input('visitCode', mssql.NVarChar, combinedData.visitNo)
            .input('visitDateTime', mssql.DateTime, combinedData.registrationDateTime)
            .input('patientID', mssql.Int, patientID)
            .input('centerId', mssql.Int, combinedData.centerId)
            .input('referedId', mssql.Int, combinedData.referedId)
            .input('doctorId', mssql.Int, combinedData.doctorId)
            .input('discountAmount', mssql.Decimal(10, 2), combinedData.discountAmount || 0)
            .input('grossAmount', mssql.Decimal(10, 2), totalGrossAmount)
            .input('visitingCharges', mssql.Decimal(10, 2), combinedData.visitingCharges || 0)
            .input('netAmount', mssql.Decimal(10, 2), netAmount)
            .input('paymentMode', mssql.Int, combinedData.paymentMode)
            .input('paidAmount', mssql.Decimal(10, 2), combinedData.paidAmount || 0)
            .input('balanceAmount', mssql.Decimal(10, 2), balanceAmount)
            .query(visitQuery);

        const visitID = visitResult.recordset[0].VisitID;
        console.log("Generated VisitID:", visitID);

        // Insert selected tests into Visit_Trans table
        if (combinedData.selectedTests && combinedData.selectedTests.length > 0) {
            const testIds = Array.isArray(combinedData.selectedTests) ? combinedData.selectedTests : combinedData.selectedTests.split(',');
            console.log('Test IDs to be stored:', testIds);
            for (const testId of testIds) {
                await pool.request()
                    .input('visitId', mssql.Int, visitID)
                    .input('testId', mssql.Int, testId)
                    .input('profileTestsId', mssql.Int, null)
                    .query(`
                        INSERT INTO Visit_Trans (VisitID, TestID, ProfileTestsID) 
                        VALUES (@visitId, @testId, @profileTestsId)
                    `);
            }
        }

        // Insert selected profiles into Visit_Trans table
        if (combinedData.selectedProfiles && combinedData.selectedProfiles.length > 0) {
            const profileIds = Array.isArray(combinedData.selectedProfiles) ? combinedData.selectedProfiles : combinedData.selectedProfiles.split(',');
            console.log('Profile IDs to be stored:', profileIds);
            for (const profileId of profileIds) {
                await pool.request()
                    .input('visitId', mssql.Int, visitID)
                    .input('testId', mssql.Int, null)
                    .input('profileTestsId', mssql.Int, profileId)
                    .query(`
                        INSERT INTO Visit_Trans (VisitID, TestID, ProfileTestsID) 
                        VALUES (@visitId, @testId, @profileTestsId)
                    `);
            }
        }

        // Insert address details with VisitID
        const addressQuery = `
            INSERT INTO Address (VisitID, Add1, City, State, District, Pin, Country, Nationality) 
            VALUES (@visitID, @address, @city, @state, @district, @pin, @country, @nationality)
        `;
        await pool.request()
            .input('visitID', mssql.Int, visitID) // Use the generated VisitID
            .input('address', mssql.NVarChar, combinedData.address)
            .input('city', mssql.NVarChar, combinedData.city)
            .input('state', mssql.NVarChar, combinedData.state)
            .input('district', mssql.NVarChar, combinedData.district)
            .input('pin', mssql.NVarChar, combinedData.pin)
            .input('country', mssql.NVarChar, combinedData.country)
            .input('nationality', mssql.NVarChar, combinedData.nationality)
            .query(addressQuery);

        // Process and insert TRF and history files
        const trfPaths = [];
        const historyPaths = [];

        if (req.files.trfFiles) {
            for (const file of req.files.trfFiles) {
                if (file.mimetype.startsWith('image/')) {
                    const compressedPath = `uploads/compressed-${file.filename}`;
                    await sharp(file.path)
                        .resize(800)
                        .toFormat('jpeg')
                        .jpeg({ quality: 80 })
                        .toFile(compressedPath);
                    trfPaths.push(compressedPath);
                } else {
                    trfPaths.push(file.path);
                }
            }
        }

        if (req.files.historyFiles) {
            for (const file of req.files.historyFiles) {
                if (file.mimetype.startsWith('image/')) {
                    const compressedPath = `uploads/compressed-${file.filename}`;
                    await sharp(file.path)
                        .resize(800)
                        .toFormat('jpeg')
                        .jpeg({ quality: 80 })
                        .toFile(compressedPath);
                    historyPaths.push(compressedPath);
                } else {
                    historyPaths.push(file.path);
                }
            }
        }

        const trfQuery = `
            INSERT INTO Mst_TRF (VisitID, TRF1Path, TRF2Path, TRF3Path, TRF4Path, TRF5Path, TRF6Path, TRF7Path, TRF8Path, TRF9Path, TRF10Path) 
            VALUES (@visitID, @TRF1Path, @TRF2Path, @TRF3Path, @TRF4Path, @TRF5Path, @TRF6Path, @TRF7Path, @TRF8Path, @TRF9Path, @TRF10Path)
        `;

        const historyQuery = `
            INSERT INTO Patient_history (VisitID, PTH1Path, PTH2Path, PTH3Path, PTH4Path, PTH5Path, PTH6Path, PTH7Path, PTH8Path, PTH9Path, PTH10Path) 
            VALUES (@visitID, @PTH1Path, @PTH2Path, @PTH3Path, @PTH4Path, @PTH5Path, @PTH6Path, @PTH7Path, @PTH8Path, @PTH9Path, @PTH10Path)
        `;

        const trfInputs = {};
        const historyInputs = {};

        for (let i = 0; i < 10; i++) {
            trfInputs[`TRF${i + 1}Path`] = trfPaths[i] || null;
            historyInputs[`PTH${i + 1}Path`] = historyPaths[i] || null;
        }

        // Insert TRF paths into the database
        await pool.request()
            .input('visitID', mssql.Int, visitID)
            .input('TRF1Path', mssql.NVarChar, trfInputs.TRF1Path)
            .input('TRF2Path', mssql.NVarChar, trfInputs.TRF2Path)
            .input('TRF3Path', mssql.NVarChar, trfInputs.TRF3Path)
            .input('TRF4Path', mssql.NVarChar, trfInputs.TRF4Path)
            .input('TRF5Path', mssql.NVarChar, trfInputs.TRF5Path)
            .input('TRF6Path', mssql.NVarChar, trfInputs.TRF6Path)
            .input('TRF7Path', mssql.NVarChar, trfInputs.TRF7Path)
            .input('TRF8Path', mssql.NVarChar, trfInputs.TRF8Path)
            .input('TRF9Path', mssql.NVarChar, trfInputs.TRF9Path)
            .input('TRF10Path', mssql.NVarChar, trfInputs.TRF10Path)
            .query(trfQuery);

        // Insert history paths into the database
        await pool.request()
            .input('visitID', mssql.Int, visitID)
            .input('PTH1Path', mssql.NVarChar, historyInputs.PTH1Path)
            .input('PTH2Path', mssql.NVarChar, historyInputs.PTH2Path)
            .input('PTH3Path', mssql.NVarChar, historyInputs.PTH3Path)
            .input('PTH4Path', mssql.NVarChar, historyInputs.PTH4Path)
            .input('PTH5Path', mssql.NVarChar, historyInputs.PTH5Path)
            .input('PTH6Path', mssql.NVarChar, historyInputs.PTH6Path)
            .input('PTH7Path', mssql.NVarChar, historyInputs.PTH7Path)
            .input('PTH8Path', mssql.NVarChar, historyInputs.PTH8Path)
            .input('PTH9Path', mssql.NVarChar, historyInputs.PTH9Path)
            .input('PTH10Path', mssql.NVarChar, historyInputs.PTH10Path)
            .query(historyQuery);

        res.json({ success: true, patientID, visitID });
    } catch (err) {
        console.error('Error inserting into database:', err);
        res.status(500).send('Server Error');
    }
});

// Route to generate Visit Code
app.get('/generateVisitCode', async (req, res) => {
    try {
        const pool = await mssql.connect(config);

        // Fetch Prefix and visitCodeLength from Mst_Centers
        const centerConfig = await pool.request()
            .query('SELECT TOP 1 Prefix, visitCodeLength FROM Mst_Centers');
        const { Prefix, visitCodeLength } = centerConfig.recordset[0];

        // Fetch the last VisitCode and increment it
        const lastVisit = await pool.request()
            .query(`SELECT MAX(CAST(SUBSTRING(VisitCode, LEN('${Prefix}') + 1, LEN(VisitCode)) AS INT)) AS LastCode FROM Visit`);
        const nextCode = (lastVisit.recordset[0].LastCode || 0) + 1;

        // Generate the new VisitCode
        const paddedCode = nextCode.toString().padStart(visitCodeLength - Prefix.length, '0');
        const visitCode = `${Prefix}${paddedCode}`;

        res.json({ visitCode });
    } catch (err) {
        console.error('Error generating Visit Code:', err);
        res.status(500).send('Error generating Visit Code');
    }
});

// Route to suggest existing patients based on partial input
app.get('/suggestPatients', async (req, res) => {
    try {
        const query = req.query.query.trim().toUpperCase(); // Trim spaces
        const pool = await mssql.connect(config);

        // Fetch matching patient details from the database
        const result = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`)
            .execute('SearchPatients'); // Use a stored procedure to search for patients
        res.json(result.recordset); // Return matching patient details
    } catch (err) {
        console.error('Error fetching patient suggestions:', err);
        res.status(500).send('Error fetching patient suggestions');
    }
});

// Route to suggest lab names based on partial input
app.get('/suggestLabs', async (req, res) => {
    try {
        const query = req.query.query.toUpperCase(); // Convert input to uppercase
        const pool = await mssql.connect(config);

        // Fetch matching lab names from the database
        const result = await pool.request()
            .input('query', mssql.VarChar, `%${query}%`)
            .query(`
                SELECT TOP 5 CenterID, CenterName
                FROM Mst_Centers
                WHERE CenterName LIKE @query
            `);

        res.json(result.recordset); // Return matching lab names
    } catch (err) {
        console.error('Error fetching lab suggestions:', err);
        res.status(500).send('Error fetching lab suggestions');
    }
});

// Route to render the next page
app.get('/nextPage', async (req, res) => {
    try {
        const pool = await mssql.connect(config);

        // Fetch lab names from Mst_Centers
        const labsQuery = 'SELECT CenterID, CenterName FROM Mst_Centers';
        const labsResult = await pool.request().query(labsQuery);

        // Fetch payment modes from Mst_Paymentmode
        const paymentModesQuery = 'SELECT PayModeID, PaymentMode FROM Mst_Paymentmode';
        const paymentModesResult = await pool.request().query(paymentModesQuery);

        // Example fields from register.ejs (replace with actual fields)
        const fieldFromRegister1 = req.query.fieldFromRegister1 || ''; // Replace with actual logic
        const fieldFromRegister2 = req.query.fieldFromRegister2 || ''; // Replace with actual logic

        // Pass lab names, payment modes, and fields from register.ejs to nextPage.ejs
        res.render('nextPage', { 
            labs: labsResult.recordset,
            paymentModes: paymentModesResult.recordset,
            fieldFromRegister1: fieldFromRegister1,
            fieldFromRegister2: fieldFromRegister2
        });
    } catch (err) {
        console.error('Error rendering next page:', err);
        res.status(500).send('Server Error');
    }
});

app.get('/suggest-lab-names', async (req, res) => {
    const query = req.query.query;

    const sqlQuery = `
        SELECT CenterID, CenterName 
        FROM Mst_Centers 
        WHERE CenterName LIKE @query AND ActiveFlag = 1
    `;

    try {
        const pool = await mssql.connect(config);
        const result = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`)
            .query(sqlQuery);

        res.json(result.recordset); // Return matching lab names
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Server Error');
    }
});

app.get('/suggest-refer-names', async (req, res) => {
    const query = req.query.query.trim().toLowerCase(); // Trim spaces and convert to lowercase

    const sqlQuery = `
        SELECT ReferID, ReferName 
        FROM Mst_Refer 
        WHERE LOWER(LTRIM(RTRIM(ReferName))) LIKE @query
    `;

    try {
        const pool = await mssql.connect(config);
        const result = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`) // Use wildcard for partial matching
            .query(sqlQuery);

        res.json(result.recordset); // Return matching referral names
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Server Error');
    }
});

app.get('/suggest-doctor-names', async (req, res) => {
    const query = req.query.query.trim().toLowerCase(); // Trim spaces and convert to lowercase

    const sqlQuery = `
        SELECT DoctorID, DoctorName 
        FROM Mst_Doctor 
        WHERE LOWER(LTRIM(RTRIM(DoctorName))) LIKE @query
    `;

    try {
        const pool = await mssql.connect(config);
        const result = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`) // Use wildcard for partial matching
            .query(sqlQuery);

        res.json(result.recordset); // Return matching doctor names
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Server Error');
    }
});

// Route to suggest tests and profiles based on partial input
app.get('/suggest-tests-profiles', async (req, res) => {
    const query = req.query.query.trim().toLowerCase(); // Trim spaces and convert to lowercase

    const testQuery = `
        SELECT TestID, TestName, ShortCode 
        FROM Mst_Test 
        WHERE LOWER(TestName) LIKE @query OR LOWER(ShortCode) LIKE @query
    `;

    const profileQuery = `
        SELECT ProfileID, ProfileName, ProfileCode 
        FROM Mst_Profiles 
        WHERE LOWER(ProfileName) LIKE @query OR LOWER(ProfileCode) LIKE @query
    `;

    try {
        const pool = await mssql.connect(config);

        const testResults = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`)
            .query(testQuery);

        const profileResults = await pool.request()
            .input('query', mssql.NVarChar, `%${query}%`)
            .query(profileQuery);

        res.json({
            tests: testResults.recordset,
            profiles: profileResults.recordset
        });
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Server Error');
    }
});

// Route to fetch payment modes
app.get('/fetch-payment-modes', async (req, res) => {
    try {
        const pool = await mssql.connect(config);

        const query = 'SELECT PayModeID, PaymentMode FROM Mst_Paymentmode';
        const result = await pool.request().query(query);

        res.json(result.recordset); // Return payment modes
    } catch (err) {
        console.error('Error fetching payment modes:', err);
        res.status(500).send('Error fetching payment modes');
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});