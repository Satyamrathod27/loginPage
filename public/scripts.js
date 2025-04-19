let selectedTests = [];
let selectedProfiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const patientUIDContainer = document.getElementById('patientUIDContainer');
    const patientUIDField = document.getElementById('patientUID');
    const nextButton = document.querySelector('.next-btn');
    const clearButton = document.querySelector('.clear-btn');

    // Function to validate mandatory fields
    function validateForm() {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            const errorMsg = field.parentElement.querySelector('.error-msg');
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error-border'); // Highlight the empty field
                if (errorMsg) {
                    errorMsg.textContent = 'This field is required.';
                }
            } else {
                field.classList.remove('error-border');
                if (errorMsg) {
                    errorMsg.textContent = ''; // Clear the error message
                }
            }
        });

        return isValid;
    }

    // Handle "Next" button click
    nextButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default behavior

        if (validateForm()) {
            form.submit(); // Submit the form to /register
        } else {
            alert('Please fill out all mandatory fields.');
        }
    });

    // Handle "Clear" button click
    clearButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default reset behavior

        const confirmClear = confirm('Are you sure you want to clear the form?');
        if (confirmClear) {
            // Reset the form
            form.reset(); // Reset all form fields to their default values

            // Clear dynamically updated fields
            const dynamicFields = ['netAmount', 'balanceAmount', 'paidAmount', 'discountAmount', 'grossAmount', 'visitingCharges'];
            dynamicFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });

            // Clear error messages
            const errorMessages = document.querySelectorAll('.error-msg');
            errorMessages.forEach(error => {
                error.textContent = '';
            });

            // Remove error borders
            const errorFields = document.querySelectorAll('.error-border');
            errorFields.forEach(field => {
                field.classList.remove('error-border');
            });

            // Clear dynamically added elements (e.g., selected tests, profiles, suggestions)
            const dynamicContainers = ['selectedTestsProfiles', 'centerNameSuggestions', 'referNameSuggestions', 'doctorNameSuggestions', 'testProfileSuggestions'];
            dynamicContainers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) container.innerHTML = ''; // Clear the container
            });

            // Clear dynamically added elements (e.g., selected tests and profiles)
            const selectedTestsProfilesContainer = document.getElementById('selectedTestsProfiles');
            if (selectedTestsProfilesContainer) {
                selectedTestsProfilesContainer.innerHTML = ''; // Clear all child elements
            }

            // Clear selected tests and profiles arrays
            selectedTests = [];
            selectedProfiles = [];

            // Hide any visible suggestion containers
            const suggestionContainers = document.querySelectorAll('.suggestions-container');
            suggestionContainers.forEach(container => {
                container.style.display = 'none';
            });

            // Clear any hidden input fields (e.g., IDs for selected labs, doctors, etc.)
            const hiddenFields = ['centerId', 'referedId', 'doctorId'];
            hiddenFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });

            alert('All fields have been cleared.');
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        fetch('/generateVisitCode')
            .then(response => response.json())
            .then(data => {
                document.getElementById('visitNo').value = data.visitCode;
            })
            .catch(err => console.error('Error fetching Visit Code:', err));
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent default form submission

        const formData = new FormData(form);

        // Send form data to the server
        fetch('/register', {
            method: 'POST',
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Display the Patient UID field and populate it with the generated ID
                    patientUIDField.value = data.patientUID;
                    patientUIDContainer.style.display = 'block';
                    alert('Registration successful! Patient UID: ' + data.patientUID);
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(err => {
                console.error('Error during registration:', err);
                alert('An error occurred while saving the registration.');
            });
    });

    // Populate the Registration Date & Time field with the current date and time in IST
    const registrationDateTimeField = document.getElementById('registrationDateTime');
    if (registrationDateTimeField) {
        const now = new Date(); // Fetches the current UTC date and time
        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // IST offset in milliseconds (5 hours 30 minutes)
        const istTime = new Date(now.getTime() + istOffset); // Adjust to IST
        const formattedDateTime = istTime.toISOString().slice(0, 16); // Format as "YYYY-MM-DDTHH:mm"
        registrationDateTimeField.value = formattedDateTime; // Sets the value in the input field
    }

    // Fetch and populate the Visit No field
    const visitNoField = document.getElementById('visitNo');
    if (visitNoField) {
        fetch('/generateVisitCode')
            .then(response => response.json())
            .then(data => {
                visitNoField.value = data.visitCode;
            })
            .catch(err => console.error('Error fetching Visit Code:', err));
    }

    // Suggest existing patient names and auto-fill details
    const patientNameField = document.getElementById('patientName');
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'suggestions';
    suggestionsContainer.classList.add('suggestions-container'); // Add a CSS class
    document.body.appendChild(suggestionsContainer);

    if (patientNameField) {
        patientNameField.addEventListener('input', () => {
            const query = patientNameField.value.trim();
            if (query.length >= 2) {
                fetch(`/suggestPatients?query=${query}`)
                    .then(response => response.json())
                    .then(data => {
                        // Clear previous suggestions
                        suggestionsContainer.innerHTML = '';
                        if (data.length > 0) {
                            suggestionsContainer.style.display = 'block';
                            const rect = patientNameField.getBoundingClientRect();
                            suggestionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
                            suggestionsContainer.style.left = `${rect.left + window.scrollX}px`;
                            suggestionsContainer.style.width = `${rect.width}px`;

                            // Populate suggestions
                            data.forEach(patient => {
                                const suggestion = document.createElement('div');
                                suggestion.textContent = `${patient.PatientName} (ID: ${patient.PatientID})`;
                                suggestion.classList.add('suggestion-item'); // Add a CSS class
                                suggestion.addEventListener('click', () => {
                                    // Populate fields with selected patient details
                                    patientNameField.value = patient.PatientName;
                                    document.getElementById('gender').value = patient.Gender || '';
                                    document.getElementById('dob').value = patient.DOB ? new Date(patient.DOB).toISOString().split('T')[0] : '';
                                    document.getElementById('age').value = patient.Age || '';
                                    document.getElementById('email').value = patient.EmailID || '';
                                    document.getElementById('phone').value = patient.MobileNo || '';
                                    document.getElementById('address').value = patient.Address || '';
                                    document.getElementById('pin').value = patient.Pin || '';

                                    suggestionsContainer.style.display = 'none';
                                });
                                suggestionsContainer.appendChild(suggestion);
                            });
                        } else {
                            suggestionsContainer.style.display = 'none';
                        }
                    })
                    .catch(err => console.error('Error fetching patient suggestions:', err));
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!suggestionsContainer.contains(event.target) && event.target !== patientNameField) {
                suggestionsContainer.style.display = 'none';
            }
        });
    }
});

// Update the patient suggestion logic to populate Patient UID field
document.addEventListener('DOMContentLoaded', () => {
    const patientNameField = document.getElementById('patientName');
    const patientUIDField = document.getElementById('patientUID'); // Patient UID field
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'suggestions';
    suggestionsContainer.classList.add('suggestions-container');
    document.body.appendChild(suggestionsContainer);

    if (patientNameField) {
        patientNameField.addEventListener('input', () => {
            const query = patientNameField.value.trim();
            if (query.length >= 2) {
                fetch(`/suggestPatients?query=${query}`)
                    .then(response => response.json())
                    .then(data => {
                        // Clear previous suggestions
                        suggestionsContainer.innerHTML = '';
                        if (data.length > 0) {
                            suggestionsContainer.style.display = 'block';
                            const rect = patientNameField.getBoundingClientRect();
                            suggestionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
                            suggestionsContainer.style.left = `${rect.left + window.scrollX}px`;
                            suggestionsContainer.style.width = `${rect.width}px`;

                            // Populate suggestions
                            data.forEach(patient => {
                                const suggestion = document.createElement('div');
                                suggestion.textContent = `${patient.PatientName} (ID: ${patient.PatientID})`;
                                suggestion.classList.add('suggestion-item');
                                suggestion.addEventListener('click', () => {
                                    // Populate fields with selected patient details
                                    patientNameField.value = patient.PatientName;
                                    patientUIDField.value = patient.PatientID; // Set Patient UID
                                    document.getElementById('gender').value = patient.Gender || '';
                                    document.getElementById('dob').value = patient.DOB ? new Date(patient.DOB).toISOString().split('T')[0] : '';
                                    document.getElementById('age').value = patient.Age || '';
                                    document.getElementById('email').value = patient.EmailID || '';
                                    document.getElementById('phone').value = patient.MobileNo || '';
                                    document.getElementById('address').value = patient.Address || '';
                                    document.getElementById('pin').value = patient.Pin || '';

                                    suggestionsContainer.style.display = 'none';
                                });
                                suggestionsContainer.appendChild(suggestion);
                            });
                        } else {
                            suggestionsContainer.style.display = 'none';
                        }
                    })
                    .catch(err => console.error('Error fetching patient suggestions:', err));
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!suggestionsContainer.contains(event.target) && event.target !== patientNameField) {
                suggestionsContainer.style.display = 'none';
            }
        });
    }
});

// Function to fetch and populate patient details
function fetchPatientDetails(patientID) {
    fetch(`/getPatientDetails?patientID=${patientID}`)
        .then(response => response.json())
        .then(data => {
            if (data) {
                // Populate form fields with patient details
                document.getElementById('gender').value = data.Gender || '';
                document.getElementById('dob').value = data.DOB || '';
                document.getElementById('age').value = data.Age || '';
                document.getElementById('email').value = data.Email || '';
                document.getElementById('phone').value = data.Phone || '';
                document.getElementById('address').value = data.Address || '';
                document.getElementById('pin').value = data.Pin || '';
                // Add more fields as needed
            }
        })
        .catch(err => console.error('Error fetching patient details:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const dobField = document.getElementById('dob');
    const ageField = document.getElementById('age');

    // Auto-calculate age when DOB is entered
    dobField.addEventListener('change', () => {
        const dob = new Date(dobField.value);
        const today = new Date();

        if (dob > today) {
            alert('Date of Birth cannot be in the future.');
            dobField.value = '';
            ageField.value = '';
            return;
        }

        // Calculate age
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        const dayDiff = today.getDate() - dob.getDate();

        // Adjust age if the current date is before the birth date in the current year
        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age--;
        }

        // Ensure age is valid
        if (age < 0 || age > 150) {
            alert('Age must be a positive number and less than 150.');
            dobField.value = '';
            ageField.value = '';
            return;
        }

        ageField.value = age; // Set the calculated age
    });

    // Validate age input
    ageField.addEventListener('input', () => {
        const age = parseInt(ageField.value, 10);
        if (age < 0 || age > 150) {
            alert('Age must be a positive number and less than 150.');
            ageField.value = '';
        }
    });

    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');

    // Validate email format
    emailField.addEventListener('input', () => {
        const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
        if (!emailPattern.test(emailField.value)) {
            emailField.setCustomValidity('Enter a valid email address (e.g., user@example.com)');
        } else {
            emailField.setCustomValidity('');
        }
    });

    // Validate phone number format
    phoneField.addEventListener('input', () => {
        const phonePattern = /^[0-9]{10}$/;
        if (!phonePattern.test(phoneField.value)) {
            phoneField.setCustomValidity('Enter a valid 10-digit phone number');
        } else {
            phoneField.setCustomValidity('');
        }
    });

    const pinField = document.getElementById('pin');

    // Validate pin code input
    pinField.addEventListener('input', () => {
        const pinPattern = /^[0-9]{6}$/;
        if (!pinPattern.test(pinField.value)) {
            pinField.setCustomValidity('Pin code should be a 6-digit number');
        } else {
            pinField.setCustomValidity('');
        }
    });

    // Validate file count for TRF and History documents
    function validateFileCount(input, maxFiles) {
        if (input.files.length > maxFiles) {
            alert(`You can upload a maximum of ${maxFiles} files.`);
            input.value = ''; // Clear the input
        }
    }

    // Attach validation to TRF files input
    const trfFilesInput = document.getElementById('trfFiles');
    if (trfFilesInput) {
        trfFilesInput.addEventListener('change', () => validateFileCount(trfFilesInput, 10));
    }

    // Attach validation to History files input
    const historyFilesInput = document.getElementById('historyFiles');
    if (historyFilesInput) {
        historyFilesInput.addEventListener('change', () => validateFileCount(historyFilesInput, 10));
    }

    // Validate file types and sizes
    function validateFiles(input) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        for (const file of input.files) {
            if (!allowedTypes.includes(file.type)) {
                alert(`Invalid file type: ${file.name}. Only PDF and image files are allowed.`);
                input.value = ''; // Clear the input
                return;
            }
            if (file.size > maxSize) {
                alert(`File too large: ${file.name}. Maximum size is 5MB.`);
                input.value = ''; // Clear the input
                return;
            }
        }
    }

    // Attach validation for file types and sizes
    if (trfFilesInput) {
        trfFilesInput.addEventListener('change', () => validateFiles(trfFilesInput));
    }
    if (historyFilesInput) {
        historyFilesInput.addEventListener('change', () => validateFiles(historyFilesInput));
    }

    const labSearch = document.getElementById('labSearch');
    const labSuggestions = document.getElementById('labSuggestions');
    const centerIdInput = document.getElementById('centerId');

    // Fetch lab suggestions dynamically
    labSearch.addEventListener('input', async () => {
        const query = labSearch.value.trim();
        if (query.length < 2) {
            labSuggestions.innerHTML = ''; // Clear suggestions if input is too short
            centerIdInput.value = ''; // Clear the hidden input
            return;
        }

        try {
            const response = await fetch(`/suggestLabs?query=${query}`);
            if (!response.ok) {
                throw new Error('Failed to fetch lab suggestions');
            }

            const labs = await response.json();
            labSuggestions.innerHTML = ''; // Clear previous suggestions

            if (labs.length === 0) {
                const noResult = document.createElement('li');
                noResult.textContent = 'No labs found';
                noResult.classList.add('no-result');
                labSuggestions.appendChild(noResult);
                return;
            }

            labs.forEach(lab => {
                const li = document.createElement('li');
                li.textContent = lab.CenterName;
                li.dataset.centerId = lab.CenterId; // Store the CenterId in a data attribute
                li.classList.add('suggestion-item');
                labSuggestions.appendChild(li);
            });
        } catch (err) {
            console.error('Error fetching lab suggestions:', err);
        }
    });

    // Handle suggestion click
    labSuggestions.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            labSearch.value = event.target.textContent; // Set the input value to the selected lab name
            centerIdInput.value = event.target.dataset.centerId; // Set the hidden input value to the selected CenterId
            labSuggestions.innerHTML = ''; // Clear suggestions
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (event) => {
        if (!labSearch.contains(event.target) && !labSuggestions.contains(event.target)) {
            labSuggestions.innerHTML = ''; // Clear suggestions
        }
    });

    const testProfileInput = document.getElementById('testProfile');
    if (testProfileInput) {
        testProfileInput.addEventListener('input', suggestTestsAndProfiles);
    }

    const clearbutton = document.querySelector('.clear-btn');
    if (clearbutton) {
        clearbutton.addEventListener('click', clearSelections);
    }

});

document.addEventListener('DOMContentLoaded', function () {
    const centerNameInput = document.getElementById('centerName');
    const suggestionsContainer = document.getElementById('centerNameSuggestions');

    // Check if the elements exist before adding event listeners
    if (centerNameInput && suggestionsContainer) {
        centerNameInput.addEventListener('input', suggestLabNames);

        // Close suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!centerNameInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
                suggestionsContainer.innerHTML = ''; // Clear suggestions
                suggestionsContainer.style.display = 'none'; // Hide suggestions
            }
        });
    } else {
        console.error("Required elements not found in the DOM.");
    }
});

function suggestLabNames(event) {
    const query = event.target.value.trim();
    const suggestionsContainer = document.getElementById('centerNameSuggestions');

    if (query.length >= 2) {
        fetch(`/suggest-lab-names?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestionsContainer.innerHTML = ''; // Clear previous suggestions
                suggestionsContainer.style.display = 'block'; // Make suggestions visible

                if (data.length === 0) {
                    const noResult = document.createElement('div');
                    noResult.textContent = 'No labs found';
                    noResult.classList.add('no-result');
                    suggestionsContainer.appendChild(noResult);
                    return;
                }

                data.forEach(center => {
                    const div = document.createElement('div');
                    div.textContent = center.CenterName;
                    div.classList.add('suggestion-item');
                    div.addEventListener('click', () => {
                        const centerNameInput = document.getElementById('centerName');
                        const centerIdInput = document.getElementById('centerId');
                        centerNameInput.value = center.CenterName; // Set the lab name
                        centerIdInput.value = center.CenterID; // Set the hidden CenterId
                        suggestionsContainer.innerHTML = ''; // Clear suggestions
                        suggestionsContainer.style.display = 'none'; // Hide suggestions
                    });
                    suggestionsContainer.appendChild(div);
                });
            })
            .catch(err => {
                console.error('Error fetching lab suggestions:', err);
            });
    } else {
        suggestionsContainer.innerHTML = ''; // Clear suggestions if input is too short
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
}

// Close suggestions when clicking outside
document.addEventListener('click', (event) => {
    const suggestionsContainer = document.getElementById('centerNameSuggestions');
    const centerNameInput = document.getElementById('centerName');
    if (!centerNameInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        suggestionsContainer.innerHTML = ''; // Clear suggestions
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Your DOM-related code here
    const centerNameInput = document.getElementById('centerName');
    const suggestionsContainer = document.getElementById('centerNameSuggestions');

    // Check if the elements exist before adding event listeners
    if (centerNameInput && suggestionsContainer) {
        centerNameInput.addEventListener('input', suggestLabNames);

        // Close suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!centerNameInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
                suggestionsContainer.innerHTML = ''; // Clear suggestions
                suggestionsContainer.style.display = 'none'; // Hide suggestions
            }
        });
    } else {
        console.error("Required elements not found in the DOM.");
    }

    console.log(document.getElementById('centerName')); // Should log the input element
    console.log(document.getElementById('centerNameSuggestions')); // Should log the suggestions container
});

function suggestReferNames(event) {
    const query = event.target.value.trim();
    const suggestionsContainer = document.getElementById('referNameSuggestions');

    if (query.length >= 2) {
        fetch(`/suggest-refer-names?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestionsContainer.innerHTML = ''; // Clear previous suggestions
                suggestionsContainer.style.display = 'block'; // Make suggestions visible

                if (data.length === 0) {
                    const noResult = document.createElement('div');
                    noResult.textContent = 'No referrals found';
                    noResult.classList.add('no-result');
                    suggestionsContainer.appendChild(noResult);
                    return;
                }

                data.forEach(refer => {
                    const div = document.createElement('div');
                    div.textContent = refer.ReferName;
                    div.classList.add('suggestion-item');
                    div.addEventListener('click', () => {
                        const referNameInput = document.getElementById('referName');
                        const referedIdInput = document.getElementById('referedId');
                        referNameInput.value = refer.ReferName; // Set the referral name
                        referedIdInput.value = refer.ReferID; // Set the hidden ReferedId
                        suggestionsContainer.innerHTML = ''; // Clear suggestions
                        suggestionsContainer.style.display = 'none'; // Hide suggestions
                    });
                    suggestionsContainer.appendChild(div);
                });
            })
            .catch(err => {
                console.error('Error fetching referral suggestions:', err);
            });
    } else {
        suggestionsContainer.innerHTML = ''; // Clear suggestions if input is too short
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
}

// Close suggestions when clicking outside
document.addEventListener('click', (event) => {
    const suggestionsContainer = document.getElementById('referNameSuggestions');
    const referNameInput = document.getElementById('referName');
    if (!referNameInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        suggestionsContainer.innerHTML = ''; // Clear suggestions
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
});

function suggestDoctorNames(event) {
    const query = event.target.value.trim(); // Trim spaces
    const suggestionsContainer = document.getElementById('doctorNameSuggestions');

    if (query.length >= 2) {
        fetch(`/suggest-doctor-names?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestionsContainer.innerHTML = ''; // Clear previous suggestions
                suggestionsContainer.style.display = 'block'; // Make suggestions visible

                if (data.length === 0) {
                    const noResult = document.createElement('div');
                    noResult.textContent = 'No doctors found';
                    noResult.classList.add('no-result');
                    suggestionsContainer.appendChild(noResult);
                    return;
                }

                data.forEach(doctor => {
                    const div = document.createElement('div');
                    div.textContent = doctor.DoctorName;
                    div.classList.add('suggestion-item');
                    div.addEventListener('click', () => {
                        const doctorNameInput = document.getElementById('doctorName');
                        const doctorIdInput = document.getElementById('doctorId');
                        doctorNameInput.value = doctor.DoctorName; // Set the doctor name
                        doctorIdInput.value = doctor.DoctorID; // Set the hidden DoctorID
                        suggestionsContainer.innerHTML = ''; // Clear suggestions
                        suggestionsContainer.style.display = 'none'; // Hide suggestions
                    });
                    suggestionsContainer.appendChild(div);
                });
            })
            .catch(err => {
                console.error('Error fetching doctor suggestions:', err);
            });
    } else {
        suggestionsContainer.innerHTML = ''; // Clear suggestions if input is too short
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
}

// Close suggestions when clicking outside
document.addEventListener('click', (event) => {
    const suggestionsContainer = document.getElementById('doctorNameSuggestions');
    const doctorNameInput = document.getElementById('doctorName');
    if (!doctorNameInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        suggestionsContainer.innerHTML = ''; // Clear suggestions
        suggestionsContainer.style.display = 'none'; // Hide suggestions
    }
});

function suggestTestsAndProfiles(event) {
    const query = event.target.value.trim();
    const suggestionsContainer = document.getElementById('testProfileSuggestions');

    if (query.length >= 2) {
        fetch(`/suggest-tests-profiles?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestionsContainer.innerHTML = '';

                data.tests.forEach(test => {
                    if (!selectedTests.includes(test.TestID)) { // Exclude already selected tests
                        const suggestion = document.createElement('div');
                        suggestion.classList.add('suggestion-item');
                        suggestion.textContent = `${test.TestName} (${test.ShortCode})`;
                        suggestion.addEventListener('click', () => {
                            addSelectedItem('test', test.TestID, test.TestName, test.ShortCode);
                            suggestionsContainer.innerHTML = ''; // Clear suggestions after selection
                            suggestionsContainer.style.display = 'none'; // Hide the container after selection
                        });
                        suggestionsContainer.appendChild(suggestion);
                    }
                });

                data.profiles.forEach(profile => {
                    if (!selectedProfiles.includes(profile.ProfileID)) { // Exclude already selected profiles
                        const suggestion = document.createElement('div');
                        suggestion.classList.add('suggestion-item');
                        suggestion.textContent = `${profile.ProfileName} (${profile.ProfileCode})`;
                        suggestion.addEventListener('click', () => {
                            addSelectedItem('profile', profile.ProfileID, profile.ProfileName, profile.ProfileCode);
                            suggestionsContainer.innerHTML = ''; // Clear suggestions after selection
                            suggestionsContainer.style.display = 'none'; // Hide the container after selection
                        });
                        suggestionsContainer.appendChild(suggestion);
                    }
                });

                suggestionsContainer.style.display = 'block'; // Ensure the container is visible
            })
            .catch(err => console.error('Error fetching suggestions:', err));
    } else {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none'; // Hide the container if the query is too short
    }
}

function addSelectedItem(type, id, name, code) {
    const selectedContainer = document.getElementById('selectedTestsProfiles');
    const item = document.createElement('div');
    item.classList.add('selected-item');
    item.textContent = `${name} (${code})`;

    const removeBtn = document.createElement('button');
    removeBtn.style.width = "auto";
    removeBtn.textContent = '×';
    removeBtn.classList.add('remove-btn');
    removeBtn.addEventListener('click', () => {
        item.remove();
        if (type === 'test') {
            selectedTests = selectedTests.filter(testId => testId !== id);
            document.getElementById('selectedTests').value = selectedTests.join(',');
        } else {
            selectedProfiles = selectedProfiles.filter(profileId => profileId !== id);
            document.getElementById('selectedProfiles').value = selectedProfiles.join(',');
        }
    });

    item.appendChild(removeBtn);
    selectedContainer.appendChild(item);

    if (type === 'test') {
        selectedTests.push(id);
        document.getElementById('selectedTests').value = selectedTests.join(',');
    } else {
        selectedProfiles.push(id);
        document.getElementById('selectedProfiles').value = selectedProfiles.join(',');
    }
}

window.clearSelections = function () {
    const confirmation = confirm("Are you sure you want to clear the form? All data will be lost.");
    if (confirmation) {
        selectedTests = [];
        selectedProfiles = [];
        document.getElementById('selectedTests').value = '';
        document.getElementById('selectedProfiles').value = '';
        document.getElementById('selectedTestsProfiles').innerHTML = '';
    }
};

window.clearSelections = function () {
    // Prompt the user for confirmation
    const confirmation = confirm("Are you sure you want to clear the form? All data will be lost.");
    if (confirmation) {
        // Reset the form
        const form = document.querySelector('form');
        form.reset();

        // Optionally, clear any custom error messages or dynamically updated fields
        const errorMessages = document.querySelectorAll('.error-msg');
        errorMessages.forEach((error) => {
            error.style.display = 'none';
        });

        // Clear dynamically updated fields like Net Amount, Balance Amount, etc.
        const netAmountInput = document.getElementById('netAmount');
        const balanceAmountInput = document.getElementById('balanceAmount');
        if (netAmountInput) netAmountInput.value = '';
        if (balanceAmountInput) balanceAmountInput.value = '';

        // Clear selected tests and profiles
        document.getElementById('selectedTestsProfiles').innerHTML = '';
        selectedTests = [];
        selectedProfiles = [];
    }
};

function validateDiscountAmount() {
    const grossAmount = parseFloat(document.getElementById('grossAmount').value) || 0;
    const discountAmountInput = document.getElementById('discountAmount');
    const discountAmount = parseFloat(discountAmountInput.value) || 0;
    const discountError = document.getElementById('discountError');

    if (discountAmount > grossAmount) {
        discountError.style.display = 'block'; // Show error message
        discountAmountInput.value = ''; // Clear invalid input
    } else {
        discountError.style.display = 'none'; // Hide error message
    }
}

function updateGrossAmount() {
    const grossAmountInput = document.getElementById('grossAmount');
    const visitingChargesInput = document.getElementById('visitingCharges');

    const grossAmount = parseFloat(grossAmountInput.value) || 0;
    const visitingCharges = parseFloat(visitingChargesInput.value) || 0;

    // Update the gross amount to include visiting charges
    const totalGrossAmount = grossAmount + visitingCharges;

    // Display the updated gross amount
    grossAmountInput.value = totalGrossAmount.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
    const grossAmountInput = document.getElementById('grossAmount');
    const visitingChargesInput = document.getElementById('visitingCharges');
    const discountAmountInput = document.getElementById('discountAmount');
    const netAmountInput = document.getElementById('netAmount');

    // Store the original gross amount
    let originalGrossAmount = parseFloat(grossAmountInput.value) || 0;

    // Update the gross amount when visiting charges change
    visitingChargesInput.addEventListener('blur', () => {
        const visitingCharges = parseFloat(visitingChargesInput.value) || 0;

        // Calculate the new total gross amount
        const totalGrossAmount = originalGrossAmount + visitingCharges;

        // Update the gross amount field
        grossAmountInput.value = totalGrossAmount.toFixed(2);

        // Update the net amount
        updateNetAmount();
    });

    // Update the original gross amount if the user changes it manually
    grossAmountInput.addEventListener('input', () => {
        originalGrossAmount = parseFloat(grossAmountInput.value) || 0;
        updateNetAmount();
    });

    // Function to update the net amount
    function updateNetAmount() {
        const grossAmount = parseFloat(grossAmountInput.value) || 0;
        const discountAmount = parseFloat(discountAmountInput.value) || 0;

        // Validate that discount does not exceed gross amount
        if (discountAmount > grossAmount) {
            document.getElementById('discountError').style.display = 'block';
            discountAmountInput.value = '';
            netAmountInput.value = grossAmount.toFixed(2); // Reset net amount
            return;
        } else {
            document.getElementById('discountError').style.display = 'none';
        }

        // Calculate the net amount
        const netAmount = grossAmount - discountAmount;

        // Update the net amount field
        netAmountInput.value = netAmount.toFixed(2);
    }

    // Add event listener for discount amount changes
    discountAmountInput.addEventListener('input', updateNetAmount);
});

document.addEventListener('DOMContentLoaded', () => {
    const netAmountInput = document.getElementById('netAmount');
    const paidAmountInput = document.getElementById('paidAmount');
    const paidAmountError = document.getElementById('paidAmountError');

    // Function to validate the paid amount
    function validatePaidAmount() {
        const netAmount = parseFloat(netAmountInput.value) || 0;
        const paidAmount = parseFloat(paidAmountInput.value) || 0;

        if (paidAmount > netAmount) {
            paidAmountError.style.display = 'block'; // Show error message
            paidAmountInput.value = ''; // Clear invalid input
        } else {
            paidAmountError.style.display = 'none'; // Hide error message
        }
    }

    // Add event listener for paid amount validation
    paidAmountInput.addEventListener('input', validatePaidAmount);
});

document.addEventListener('DOMContentLoaded', () => {
    const grossAmountInput = document.getElementById('grossAmount');
    const visitingChargesInput = document.getElementById('visitingCharges');
    const discountAmountInput = document.getElementById('discountAmount');
    const netAmountInput = document.getElementById('netAmount');
    const paidAmountInput = document.getElementById('paidAmount');
    const balanceAmountInput = document.getElementById('balanceAmount');
    const paidAmountError = document.getElementById('paidAmountError');

    // Store the previous value of visiting charges
    let previousVisitingCharges = parseFloat(visitingChargesInput.value) || 0;

    // Function to update the gross amount with visiting charges
    function updateGrossAmount() {
        const grossAmount = parseFloat(grossAmountInput.value) || 0;
        const visitingCharges = parseFloat(visitingChargesInput.value) || 0;

        // Only update the gross amount if visiting charges have changed
        if (visitingCharges !== previousVisitingCharges) {
            const totalGrossAmount = grossAmount - previousVisitingCharges + visitingCharges;
            grossAmountInput.value = totalGrossAmount.toFixed(2);

            // Update the previous visiting charges value
            previousVisitingCharges = visitingCharges;

            // Update the net amount
            updateNetAmount();
        }
    }

    // Function to update the net amount
    function updateNetAmount() {
        const grossAmount = parseFloat(grossAmountInput.value) || 0;
        const discountAmount = parseFloat(discountAmountInput.value) || 0;

        // Calculate the net amount
        const netAmount = grossAmount - discountAmount;

        // Update the net amount field
        netAmountInput.value = netAmount.toFixed(2);

        // Update the balance amount
        updateBalanceAmount();
    }

    // Function to validate and update the paid amount
    function updatePaidAmount() {
        const netAmount = parseFloat(netAmountInput.value) || 0;
        const paidAmount = parseFloat(paidAmountInput.value) || 0;

        // If the paid amount exceeds the net amount, reset it
        if (paidAmount > netAmount) {
            paidAmountError.style.display = 'block'; // Show error message
            paidAmountInput.value = ''; // Clear invalid input
        } else {
            paidAmountError.style.display = 'none'; // Hide error message
        }

        // Update the balance amount
        updateBalanceAmount();
    }

    // Function to update the balance amount
    function updateBalanceAmount() {
        const netAmount = parseFloat(netAmountInput.value) || 0;
        const paidAmount = parseFloat(paidAmountInput.value) || 0;

        // Calculate the balance amount
        const balanceAmount = netAmount - paidAmount;

        // Update the balance amount field
        balanceAmountInput.value = balanceAmount.toFixed(2);
    }

    // Add event listener for changes in the visiting charges field
    visitingChargesInput.addEventListener('input', updateGrossAmount);

    // Add event listener for changes in the discount amount field
    discountAmountInput.addEventListener('input', updateNetAmount);

    // Add event listener for changes in the paid amount field
    paidAmountInput.addEventListener('input', updatePaidAmount);
});

document.addEventListener('DOMContentLoaded', () => {
    const grossAmountInput = document.getElementById('grossAmount');
    const balanceAmountInput = document.getElementById('balanceAmount');
    const paidAmountInput = document.getElementById('paidAmount');

    // Add event listener for changes in the Gross Amount field
    grossAmountInput.addEventListener('input', updateBalanceAmount);

    // Add event listener for changes in the Paid Amount field
    paidAmountInput.addEventListener('input', updateBalanceAmount);
});

document.addEventListener('DOMContentLoaded', () => {
    const testProfileInput = document.getElementById('testProfile');
    if (testProfileInput) {
        testProfileInput.addEventListener('input', suggestTestsAndProfiles);
    }

    const clearButton = document.querySelector('.clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', clearSelections);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const patientNameField = document.getElementById('patientName');
    const patientUIDField = document.getElementById('patientUID'); // Patient UID field

    form.addEventListener('submit', (event) => {
        const patientUID = patientUIDField.value.trim();

        if (patientUID) {
            // If Patient UID exists, ensure the form uses the existing patient
            const hiddenPatientUIDInput = document.createElement('input');
            hiddenPatientUIDInput.type = 'hidden';
            hiddenPatientUIDInput.name = 'existingPatientUID';
            hiddenPatientUIDInput.value = patientUID;
            form.appendChild(hiddenPatientUIDInput);
        } else {
            // If no existing patient is selected, ensure a new patient is added
            const hiddenNewPatientInput = document.createElement('input');
            hiddenNewPatientInput.type = 'hidden';
            hiddenNewPatientInput.name = 'newPatient';
            hiddenNewPatientInput.value = 'true';
            form.appendChild(hiddenNewPatientInput);
        }
    });

    if (patientNameField) {
        patientNameField.addEventListener('input', () => {
            const query = patientNameField.value.trim();
            if (query.length >= 2) {
                fetch(`/suggestPatients?query=${query}`)
                    .then(response => response.json())
                    .then(data => {
                        const suggestionsContainer = document.getElementById('suggestions');
                        suggestionsContainer.innerHTML = '';
                        if (data.length > 0) {
                            suggestionsContainer.style.display = 'block';
                            data.forEach(patient => {
                                const suggestion = document.createElement('div');
                                suggestion.textContent = `${patient.PatientName} (ID: ${patient.PatientID})`;
                                suggestion.classList.add('suggestion-item');
                                suggestion.addEventListener('click', () => {
                                    patientNameField.value = patient.PatientName;
                                    patientUIDField.value = patient.PatientID; // Use existing Patient ID
                                    document.getElementById('gender').value = patient.Gender || '';
                                    document.getElementById('dob').value = patient.DOB ? new Date(patient.DOB).toISOString().split('T')[0] : '';
                                    document.getElementById('age').value = patient.Age || '';
                                    document.getElementById('email').value = patient.EmailID || '';
                                    document.getElementById('phone').value = patient.MobileNo || '';
                                    document.getElementById('address').value = patient.Address || '';
                                    document.getElementById('pin').value = patient.Pin || '';
                                    suggestionsContainer.style.display = 'none';
                                });
                                suggestionsContainer.appendChild(suggestion);
                            });
                        } else {
                            suggestionsContainer.style.display = 'none';
                        }
                    })
                    .catch(err => console.error('Error fetching patient suggestions:', err));
            } else {
                const suggestionsContainer = document.getElementById('suggestions');
                suggestionsContainer.style.display = 'none';
            }
        });
    }
});

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    const formSection = document.getElementById('formSection');
    drawer.classList.toggle('drawer-open');
    formSection.classList.toggle('shifted');
};
document.addEventListener('DOMContentLoaded', function() {
    const datetimeElement = document.getElementById('datetime');
    function updateDateTime() {
        const now = new Date();
        const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const istTime = now.toLocaleString('en-US', options);
        datetimeElement.textContent = `${now.toLocaleDateString()} ${istTime}`;
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
});
