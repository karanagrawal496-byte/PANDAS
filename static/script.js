// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- STATE ---
    // This holds the data we get from the Python backend
    let state = {
        foods: {},
        targets: {},
        summary: {},
        selectedFood: null,
    };

    // --- API Base URL ---
    // This points to your Flask server
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- ELEMENT REFERENCES ---
    // Get references to the parts of the page we need to control
    const mainContent = document.getElementById('main-content');
    const pandaMessageEl = document.getElementById('panda-message');
    const backButton = document.getElementById('back-button');

    // --- HELPER: Set Panda's Message ---
    function setPandaMessage(message) {
        pandaMessageEl.textContent = message;
    }

    // --- HELPER: API Fetch Function ---
    // A reusable function to talk to the backend
    async function apiFetch(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            setPandaMessage(`🐼 Oh no! An error occurred: ${error.message}`);
            console.error('API Fetch Error:', error);
            return null; // Return null on error
        }
    }


    // =================================================================
    // --- VIEW RENDERING FUNCTIONS ---
    // These functions build the different "pages" of the app
    // =================================================================

    // --- 1. Render Home View ---
    async function renderHomeView() {
        // Fetch the latest summary
        const data = await apiFetch('/get_summary');
        if (!data) return; // Stop if fetch failed

        state.summary = data;

        // Clone the HTML from the <template> tag
        const template = document.getElementById('template-home');
        const view = template.content.cloneNode(true);

        // Fill in the data
        const { totals, targets } = data;
        view.getElementById('home-total-Calories').textContent = Math.round(totals.Calories);
        view.getElementById('home-target-Calories').textContent = `of ${targets.Calories}`;
        view.getElementById('home-total-Protein').textContent = `${Math.round(totals.Protein)}g`;
        view.getElementById('home-target-Protein').textContent = `of ${targets.Protein}g`;
        view.getElementById('home-total-Fat').textContent = `${Math.round(totals.Fat)}g`;
        view.getElementById('home-target-Fat').textContent = `of ${targets.Fat}g`;
        view.getElementById('home-total-Carbs').textContent = `${Math.round(totals.Carbs)}g`;
        view.getElementById('home-target-Carbs').textContent = `of ${targets.Carbs}g`;

        // Add click listeners to navigation buttons
        view.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', () => {
                const viewName = button.getAttribute('data-view');
                showView(viewName);
            });
        });

        // Display the new view
        mainContent.innerHTML = ''; // Clear old content
        mainContent.appendChild(view);
    }

    // --- 2. Render Log Meal View ---
    async function renderLogMealView() {
        // Fetch the food list
        const foods = await apiFetch('/get_foods');
        if (!foods) return;

        state.foods = foods;
        state.selectedFood = null;

        // Clone the template
        const template = document.getElementById('template-log');
        const view = template.content.cloneNode(true);

        const foodGrid = view.getElementById('log-food-grid');
        const form = view.getElementById('log-meal-form');
        const foodNameEl = view.getElementById('log-food-name');
        const foodAmountEl = view.getElementById('log-food-amount');
        const foodUnitEl = view.getElementById('log-food-unit');
        const foodInfoEl = view.getElementById('log-food-info');

        // Create a button for each food
        for (const [foodName, details] of Object.entries(foods)) {
            const button = document.createElement('button');
            button.className = 'food-button p-3 rounded-lg border-2 border-gray-200 hover:border-green-300 transition text-left';
            button.innerHTML = `
                <div class="font-semibold text-sm">${foodName}</div>
                <div class="text-xs text-gray-600">${details.StandardAmount} ${details.StandardUnit}</div>
            `;
            
            // Add click listener to select the food
            button.addEventListener('click', () => {
                state.selectedFood = { name: foodName, ...details };
                
                // Highlight selected button
                foodGrid.querySelectorAll('.food-button').forEach(btn => {
                    btn.classList.remove('border-green-500', 'bg-green-50');
                });
                button.classList.add('border-green-500', 'bg-green-50');

                // Fill and show the form
                form.style.display = 'block';
                foodNameEl.textContent = foodName;
                foodUnitEl.textContent = details.StandardUnit;
                foodAmountEl.placeholder = `Amount in ${details.StandardUnit}`;
                foodAmountEl.value = details.StandardAmount; // Pre-fill standard amount
                foodInfoEl.innerHTML = `
                    <div>Calories: ${details.Calories}</div>
                    <div>Protein: ${details.Protein}g</div>
                    <div>Fat: ${details.Fat}g</div>
                    <div>Carbs: ${details.Carbs}g</div>
                `;
            });
            foodGrid.appendChild(button);
        }

        // Add submit listener to the form
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop page refresh
            if (!state.selectedFood) {
                setPandaMessage("Please select a food first!");
                return;
            }

            const amount = parseFloat(foodAmountEl.value);
            if (!amount || amount <= 0) {
                setPandaMessage("Please enter a valid amount!");
                return;
            }

            // Send data to backend
            const result = await apiFetch('/log_meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    food_name: state.selectedFood.name,
                    amount: amount
                })
            });

            if (result) {
                setPandaMessage(result.message); // Show success message from backend
                showView('home'); // Go back home
            }
        });
        
        // Display the new view
        mainContent.innerHTML = '';
        mainContent.appendChild(view);
    }

    // --- 3. Render Summary View ---
    async function renderSummaryView() {
        // Fetch the latest summary
        const data = await apiFetch('/get_summary');
        if (!data) return;

        state.summary = data;
        const { totals, targets, logs } = data;

        // Clone the template
        const template = document.getElementById('template-summary');
        const view = template.content.cloneNode(true);
        
        const progressBarsEl = view.getElementById('summary-progress-bars');
        const logListEl = view.getElementById('summary-log-list');

        // Create progress bars
        for (const [key, target] of Object.entries(targets)) {
            const current = totals[key];
            const percentage = Math.min((current / target) * 100, 100);
            const unit = key === 'Calories' ? '' : 'g';

            progressBarsEl.innerHTML += `
                <div class="mb-4">
                    <div class="flex justify-between mb-1">
                        <span class="font-semibold">${key}</span>
                        <span class="text-sm">${Math.round(current)}${unit} / ${target}${unit}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-3">
                        <div class="h-3 rounded-full bg-green-500" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }

        // Create list of logged meals
        if (logs.length === 0) {
            logListEl.innerHTML = '<div class="text-center py-8 text-gray-500">No meals logged yet today.</div>';
        } else {
            logs.forEach(log => {
                logListEl.innerHTML += `
                    <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                            <div class="font-semibold">${log.Food}</div>
                            <div class="text-xs text-gray-600">${log.Amount} ${log.Unit} • ${log.Time}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-green-600">${Math.round(log.Calories)} kcal</div>
                        </div>
                    </div>
                `;
            });
        }

        // Display the new view
        mainContent.innerHTML = '';
        mainContent.appendChild(view);
    }

    // --- 4. Render Set Targets View ---
    async function renderSetTargetsView() {
        // Fetch current targets
        const targets = await apiFetch('/get_targets');
        if (!targets) return;

        state.targets = targets;

        // Clone the template
        const template = document.getElementById('template-targets');
        const view = template.content.cloneNode(true);

        // Fill the form with current values
        view.getElementById('target-Calories').value = targets.Calories;
        view.getElementById('target-Protein').value = targets.Protein;
        view.getElementById('target-Fat').value = targets.Fat;
        view.getElementById('target-Carbs').value = targets.Carbs;
        
        // Add submit listener
        view.getElementById('set-targets-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get new values from form
            const newTargets = {
                Calories: parseFloat(view.getElementById('target-Calories').value),
                Protein: parseFloat(view.getElementById('target-Protein').value),
                Fat: parseFloat(view.getElementById('target-Fat').value),
                Carbs: parseFloat(view.getElementById('target-Carbs').value),
            };

            // Send new targets to backend
            const result = await apiFetch('/set_targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTargets)
            });

            if (result) {
                setPandaMessage(result.message);
                showView('home');
            }
        });

        // Display the new view
        mainContent.innerHTML = '';
        mainContent.appendChild(view);
    }


    // =================================================================
    // --- NAVIGATION ---
    // =================================================================

    function showView(viewName) {
        // Show/hide back button
        if (viewName === 'home') {
            backButton.style.display = 'none';
        } else {
            backButton.style.display = 'block';
        }

        // Call the correct render function
        switch (viewName) {
            case 'log':
                renderLogMealView();
                break;
            case 'summary':
                renderSummaryView();
                break;
            case 'targets':
                renderSetTargetsView();
                break;
            case 'home':
            default:
                renderHomeView();
                break;
        }
    }


    // =================================================================
    // --- INITIALIZATION ---
    // =================================================================
    function init() {
        // Add click listener for the back button
        backButton.addEventListener('click', () => {
            showView('home');
        });

        // Show the home view on load
        showView('home');
        setPandaMessage("Hey there! I'm PANDA, your food tracking buddy 🐾");
    }

    // Start the app!
    init();

});