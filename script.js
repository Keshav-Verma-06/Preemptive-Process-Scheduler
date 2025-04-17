// DOM Elements
const processForm = document.getElementById('process-form');
const processIdInput = document.getElementById('process-id');
const arrivalTimeInput = document.getElementById('arrival-time');
const burstTimeInput = document.getElementById('burst-time');
const priorityInput = document.getElementById('priority');
const processList = document.getElementById('process-list');
const clearProcessesBtn = document.getElementById('clear-processes');
const algorithmSelect = document.getElementById('algorithm-select');
const timeQuantumContainer = document.getElementById('time-quantum-container');
const timeQuantumInput = document.getElementById('time-quantum');
const runAlgorithmBtn = document.getElementById('run-algorithm');
const resultsSection = document.getElementById('results-section');
const avgWaitingTime = document.getElementById('avg-waiting-time');
const avgTurnaroundTime = document.getElementById('avg-turnaround-time');
const avgResponseTime = document.getElementById('avg-response-time');
const ganttChart = document.getElementById('gantt-chart');
const ganttTimeline = document.getElementById('gantt-timeline');
const resultsList = document.getElementById('results-list');
const simulationNameInput = document.getElementById('simulation-name');
const saveSimulationBtn = document.getElementById('save-simulation');
const savedSimulations = document.getElementById('saved-simulations');
const noSavedMessage = document.getElementById('no-saved-message');

// State
let processes = [];
let currentProcessId = 1;
let results = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set default process ID
    processIdInput.value = `P${currentProcessId}`;
    
    // Load saved simulations
    loadSavedSimulations();
    
    // Event listeners
    processForm.addEventListener('submit', addProcess);
    clearProcessesBtn.addEventListener('click', clearProcesses);
    algorithmSelect.addEventListener('change', toggleTimeQuantum);
    runAlgorithmBtn.addEventListener('click', runAlgorithm);
    saveSimulationBtn.addEventListener('click', saveSimulation);
    
    // Only show time quantum for Round Robin
    toggleTimeQuantum();
});

// Functions
function addProcess(e) {
    e.preventDefault();
    
    const processId = processIdInput.value.trim();
    const arrivalTime = parseInt(arrivalTimeInput.value);
    const burstTime = parseInt(burstTimeInput.value);
    const priority = parseInt(priorityInput.value);
    
    // Validate
    if (!processId) {
        alert('Please enter a process ID');
        return;
    }
    
    // Check for duplicate process ID
    if (processes.some(p => p.id === processId)) {
        alert('Process ID already exists');
        return;
    }
    
    // Add process
    const process = {
        id: processId,
        arrivalTime,
        burstTime,
        priority,
        originalBurstTime: burstTime // Keep original for calculations
    };
    
    processes.push(process);
    renderProcessList();
    
    // Reset form
    currentProcessId++;
    processIdInput.value = `P${currentProcessId}`;
    arrivalTimeInput.value = 0;
    burstTimeInput.value = 1;
    priorityInput.value = 1;
}

function renderProcessList() {
    processList.innerHTML = '';
    
    if (processes.length === 0) {
        processList.innerHTML = '<tr><td colspan="5" class="text-center">No processes added yet</td></tr>';
        return;
    }
    
    processes.forEach((process, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${process.id}</td>
            <td>${process.arrivalTime}</td>
            <td>${process.burstTime}</td>
            <td>${process.priority}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="removeProcess(${index})">Remove</button>
            </td>
        `;
        processList.appendChild(row);
    });
}

function removeProcess(index) {
    processes.splice(index, 1);
    renderProcessList();
}

function clearProcesses() {
    if (confirm('Are you sure you want to clear all processes?')) {
        processes = [];
        renderProcessList();
        resultsSection.classList.add('hidden');
    }
}

function toggleTimeQuantum() {
    if (algorithmSelect.value === 'rr') {
        timeQuantumContainer.classList.remove('hidden');
    } else {
        timeQuantumContainer.classList.add('hidden');
    }
}

function runAlgorithm() {
    if (processes.length === 0) {
        alert('Please add at least one process');
        return;
    }
    
    const algorithm = algorithmSelect.value;
    let scheduledProcesses;
    
    // Deep clone processes to avoid modifying the original array
    const processesClone = JSON.parse(JSON.stringify(processes));
    
    switch (algorithm) {
        case 'srtf':
            scheduledProcesses = srtf(processesClone);
            break;
        case 'pp':
            scheduledProcesses = preemptivePriority(processesClone);
            break;
        case 'rr':
            const timeQuantum = parseInt(timeQuantumInput.value);
            if (timeQuantum < 1) {
                alert('Time quantum must be at least 1');
                return;
            }
            scheduledProcesses = roundRobin(processesClone, timeQuantum);
            break;
        default:
            alert('Please select a valid algorithm');
            return;
    }
    
    // Calculate metrics
    calculateMetrics(scheduledProcesses);
    
    // Display results
    displayResults(scheduledProcesses);
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Scheduling Algorithms
function srtf(processes) {
    // Sort by arrival time first
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Initialize variables
    let currentTime = 0;
    let completedProcesses = 0;
    const executionSequence = [];
    const n = processes.length;
    
    // Initialize remaining time and other tracking variables
    processes.forEach(process => {
        process.remainingTime = process.burstTime;
        process.completed = false;
        process.firstExecutionTime = -1; // For response time
    });
    
    // Run until all processes are completed
    while (completedProcesses < n) {
        let shortestJob = -1;
        let shortestTime = Infinity;
        
        // Find the process with shortest remaining time that has arrived
        for (let i = 0; i < n; i++) {
            const process = processes[i];
            if (!process.completed && process.arrivalTime <= currentTime && process.remainingTime < shortestTime) {
                shortestJob = i;
                shortestTime = process.remainingTime;
            }
        }
        
        // If no process is available, advance time to next arrival
        if (shortestJob === -1) {
            // Find next arrival time
            let nextArrival = Infinity;
            for (let i = 0; i < n; i++) {
                if (!processes[i].completed && processes[i].arrivalTime < nextArrival) {
                    nextArrival = processes[i].arrivalTime;
                }
            }
            
            // Add idle time to execution sequence
            if (nextArrival !== Infinity) {
                executionSequence.push({
                    id: 'idle',
                    startTime: currentTime,
                    endTime: nextArrival,
                    isPreempted: false
                });
                currentTime = nextArrival;
            } else {
                // This shouldn't happen, but just in case
                break;
            }
            continue;
        }
        
        const process = processes[shortestJob];
        
        // Record first execution time for response time calculation
        if (process.firstExecutionTime === -1) {
            process.firstExecutionTime = currentTime;
        }
        
        // Find next event time (either process completion or new arrival that might preempt)
        let nextEventTime = currentTime + process.remainingTime;
        
        // Check if any process arrives before this one completes
        for (let i = 0; i < n; i++) {
            const p = processes[i];
            if (!p.completed && p.arrivalTime > currentTime && p.arrivalTime < nextEventTime && p.remainingTime < (process.remainingTime - (p.arrivalTime - currentTime))) {
                nextEventTime = p.arrivalTime;
            }
        }
        
        // Execute process until next event
        const executionTime = nextEventTime - currentTime;
        process.remainingTime -= executionTime;
        
        // Add to execution sequence
        const isPreempted = process.remainingTime > 0;
        executionSequence.push({
            id: process.id,
            startTime: currentTime,
            endTime: nextEventTime,
            isPreempted
        });
        
        // Update current time
        currentTime = nextEventTime;
        
        // Check if process is completed
        if (process.remainingTime === 0) {
            process.completed = true;
            process.completionTime = currentTime;
            completedProcesses++;
        }
    }
    
    return {
        processes,
        executionSequence
    };
}

function preemptivePriority(processes) {
    // Sort by arrival time first
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Initialize variables
    let currentTime = 0;
    let completedProcesses = 0;
    const executionSequence = [];
    const n = processes.length;
    
    // Initialize remaining time and other tracking variables
    processes.forEach(process => {
        process.remainingTime = process.burstTime;
        process.completed = false;
        process.firstExecutionTime = -1; // For response time
    });
    
    // Run until all processes are completed
    while (completedProcesses < n) {
        let highestPriorityJob = -1;
        let highestPriority = Infinity;
        
        // Find the process with highest priority (lowest priority number) that has arrived
        for (let i = 0; i < n; i++) {
            const process = processes[i];
            if (!process.completed && process.arrivalTime <= currentTime && process.priority < highestPriority) {
                highestPriorityJob = i;
                highestPriority = process.priority;
            }
        }
        
        // If no process is available, advance time to next arrival
        if (highestPriorityJob === -1) {
            // Find next arrival time
            let nextArrival = Infinity;
            for (let i = 0; i < n; i++) {
                if (!processes[i].completed && processes[i].arrivalTime < nextArrival) {
                    nextArrival = processes[i].arrivalTime;
                }
            }
            
            // Add idle time to execution sequence
            if (nextArrival !== Infinity) {
                executionSequence.push({
                    id: 'idle',
                    startTime: currentTime,
                    endTime: nextArrival,
                    isPreempted: false
                });
                currentTime = nextArrival;
            } else {
                // This shouldn't happen, but just in case
                break;
            }
            continue;
        }
        
        const process = processes[highestPriorityJob];
        
        // Record first execution time for response time calculation
        if (process.firstExecutionTime === -1) {
            process.firstExecutionTime = currentTime;
        }
        
        // Find next event time (either process completion or new arrival that might preempt)
        let nextEventTime = currentTime + process.remainingTime;
        
        // Check if any process arrives before this one completes
        for (let i = 0; i < n; i++) {
            const p = processes[i];
            if (!p.completed && p.arrivalTime > currentTime && p.arrivalTime < nextEventTime && p.priority < process.priority) {
                nextEventTime = p.arrivalTime;
            }
        }
        
        // Execute process until next event
        const executionTime = nextEventTime - currentTime;
        process.remainingTime -= executionTime;
        
        // Add to execution sequence
        const isPreempted = process.remainingTime > 0;
        executionSequence.push({
            id: process.id,
            startTime: currentTime,
            endTime: nextEventTime,
            isPreempted
        });
        
        // Update current time
        currentTime = nextEventTime;
        
        // Check if process is completed
        if (process.remainingTime === 0) {
            process.completed = true;
            process.completionTime = currentTime;
            completedProcesses++;
        }
    }
    
    return {
        processes,
        executionSequence
    };
}

function roundRobin(processes, timeQuantum) {
    // Sort by arrival time
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Initialize variables
    let currentTime = 0;
    let completedProcesses = 0;
    const executionSequence = [];
    const n = processes.length;
    const readyQueue = [];
    
    // Initialize remaining time and other tracking variables
    processes.forEach(process => {
        process.remainingTime = process.burstTime;
        process.completed = false;
        process.firstExecutionTime = -1; // For response time
    });
    
    // Add first process to ready queue
    if (n > 0) {
        currentTime = processes[0].arrivalTime;
        readyQueue.push(processes[0]);
    }
    
    // Run until all processes are completed
    while (completedProcesses < n) {
        // If ready queue is empty but there are still processes to arrive
        if (readyQueue.length === 0) {
            // Find next arrival time
            let nextArrival = Infinity;
            let nextProcess = null;
            
            for (let i = 0; i < n; i++) {
                if (!processes[i].completed && processes[i].arrivalTime < nextArrival) {
                    nextArrival = processes[i].arrivalTime;
                    nextProcess = processes[i];
                }
            }
            
            // Add idle time to execution sequence
            if (nextProcess) {
                executionSequence.push({
                    id: 'idle',
                    startTime: currentTime,
                    endTime: nextArrival,
                    isPreempted: false
                });
                currentTime = nextArrival;
                readyQueue.push(nextProcess);
            } else {
                // This shouldn't happen, but just in case
                break;
            }
            continue;
        }
        
        // Get process from front of queue
        const currentProcess = readyQueue.shift();
        
        // Record first execution time for response time calculation
        if (currentProcess.firstExecutionTime === -1) {
            currentProcess.firstExecutionTime = currentTime;
        }
        
        // Calculate execution time for this quantum
        const executionTime = Math.min(timeQuantum, currentProcess.remainingTime);
        
        // Add to execution sequence
        const isPreempted = currentProcess.remainingTime > executionTime;
        executionSequence.push({
            id: currentProcess.id,
            startTime: currentTime,
            endTime: currentTime + executionTime,
            isPreempted
        });
        
        // Update current time
        currentTime += executionTime;
        
        // Update remaining time
        currentProcess.remainingTime -= executionTime;
        
        // Check for newly arrived processes
        for (let i = 0; i < n; i++) {
            const process = processes[i];
            if (!process.completed && process.arrivalTime > currentTime - executionTime && 
                process.arrivalTime <= currentTime && !readyQueue.includes(process) && 
                process !== currentProcess) {
                readyQueue.push(process);
            }
        }
        
        // Check if process is completed
        if (currentProcess.remainingTime === 0) {
            currentProcess.completed = true;
            currentProcess.completionTime = currentTime;
            completedProcesses++;
        } else {
            // Add back to ready queue
            readyQueue.push(currentProcess);
        }
    }
    
    return {
        processes,
        executionSequence
    };
}

function calculateMetrics(scheduledProcesses) {
    const { processes } = scheduledProcesses;
    
    let totalWaitingTime = 0;
    let totalTurnaroundTime = 0;
    let totalResponseTime = 0;
    
    processes.forEach(process => {
        // Calculate turnaround time (completion time - arrival time)
        process.turnaroundTime = process.completionTime - process.arrivalTime;
        
        // Calculate waiting time (turnaround time - burst time)
        process.waitingTime = process.turnaroundTime - process.originalBurstTime;
        
        // Calculate response time (first execution time - arrival time)
        process.responseTime = process.firstExecutionTime - process.arrivalTime;
        
        totalWaitingTime += process.waitingTime;
        totalTurnaroundTime += process.turnaroundTime;
        totalResponseTime += process.responseTime;
    });
    
    // Calculate averages
    scheduledProcesses.avgWaitingTime = totalWaitingTime / processes.length;
    scheduledProcesses.avgTurnaroundTime = totalTurnaroundTime / processes.length;
    scheduledProcesses.avgResponseTime = totalResponseTime / processes.length;
    
    // Save results for later use
    results = scheduledProcesses;
}

function displayResults(scheduledProcesses) {
    const { processes, executionSequence, avgWaitingTime: awt, avgTurnaroundTime: att, avgResponseTime: art } = scheduledProcesses;
    
    // Display average metrics
    avgWaitingTime.textContent = awt.toFixed(2);
    avgTurnaroundTime.textContent = att.toFixed(2);
    avgResponseTime.textContent = art.toFixed(2);
    
    // Display Gantt chart
    renderGanttChart(executionSequence);
    
    // Display process details
    renderResultsTable(processes);
}

function renderGanttChart(executionSequence) {
    ganttChart.innerHTML = '';
    ganttTimeline.innerHTML = '';
    
    if (executionSequence.length === 0) return;
    
    // Find total execution time
    const totalTime = executionSequence[executionSequence.length - 1].endTime;
    
    // Create process ID to color mapping
    const processColors = {};
    const uniqueProcessIds = [...new Set(executionSequence.map(item => item.id).filter(id => id !== 'idle'))];
    uniqueProcessIds.forEach((id, index) => {
        processColors[id] = index % 8; // 8 different colors
    });
    
    // Render blocks
    executionSequence.forEach(item => {
        const duration = item.endTime - item.startTime;
        const widthPercentage = (duration / totalTime) * 100;
        
        const block = document.createElement('div');
        
        if (item.id === 'idle') {
            block.className = 'gantt-block idle';
            block.textContent = 'Idle';
        } else {
            block.className = `gantt-block process-color-${processColors[item.id]}`;
            if (item.isPreempted) {
                block.classList.add('preempted');
            }
            block.textContent = item.id;
        }
        
        block.style.width = `${widthPercentage}%`;
        block.title = `${item.id}: ${item.startTime} - ${item.endTime} (${duration})`;
        
        ganttChart.appendChild(block);
    });
    
    // Render timeline
    // Determine appropriate time step based on total time
    let timeStep = 1;
    if (totalTime > 50) timeStep = 5;
    if (totalTime > 100) timeStep = 10;
    if (totalTime > 500) timeStep = 50;
    
    for (let time = 0; time <= totalTime; time += timeStep) {
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.style.width = `${(timeStep / totalTime) * 100}%`;
        marker.textContent = time;
        
        ganttTimeline.appendChild(marker);
    }
    
    // Add legend
    const legendContainer = document.createElement('div');
    legendContainer.className = 'gantt-legend';
    
    // Add process colors to legend
    uniqueProcessIds.forEach((id, index) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = `legend-color process-color-${index % 8}`;
        
        const label = document.createElement('span');
        label.textContent = id;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
    
    // Add idle to legend
    const idleLegendItem = document.createElement('div');
    idleLegendItem.className = 'legend-item';
    
    const idleColorBox = document.createElement('div');
    idleColorBox.className = 'legend-color idle';
    
    const idleLabel = document.createElement('span');
    idleLabel.textContent = 'Idle';
    
    idleLegendItem.appendChild(idleColorBox);
    idleLegendItem.appendChild(idleLabel);
    legendContainer.appendChild(idleLegendItem);
    
    // Add preemption indicator to legend
    const preemptionLegendItem = document.createElement('div');
    preemptionLegendItem.className = 'legend-item';
    
    const preemptionIndicator = document.createElement('div');
    preemptionIndicator.className = 'preemption-indicator';
    
    const preemptionLabel = document.createElement('span');
    preemptionLabel.textContent = 'Preemption';
    
    preemptionLegendItem.appendChild(preemptionIndicator);
    preemptionLegendItem.appendChild(preemptionLabel);
    legendContainer.appendChild(preemptionLegendItem);
    
    ganttChart.parentNode.insertBefore(legendContainer, ganttChart.nextSibling);
}

function renderResultsTable(processes) {
    resultsList.innerHTML = '';
    
    processes.forEach(process => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${process.id}</td>
            <td>${process.arrivalTime}</td>
            <td>${process.originalBurstTime}</td>
            <td>${process.completionTime}</td>
            <td>${process.turnaroundTime}</td>
            <td>${process.waitingTime}</td>
            <td>${process.responseTime}</td>
        `;
        resultsList.appendChild(row);
    });
}

function saveSimulation() {
    if (!results) {
        alert('Please run a simulation first');
        return;
    }
    
    const name = simulationNameInput.value.trim() || `Simulation ${new Date().toLocaleString()}`;
    
    // Get existing simulations from localStorage
    const savedSims = JSON.parse(localStorage.getItem('preemptiveProcessSchedulerSimulations')) || [];
    
    // Add new simulation
    const simulation = {
        id: Date.now(),
        name,
        algorithm: algorithmSelect.value,
        timeQuantum: algorithmSelect.value === 'rr' ? parseInt(timeQuantumInput.value) : null,
        processes: processes,
        results
    };
    
    savedSims.push(simulation);
    
    // Save to localStorage
    localStorage.setItem('preemptiveProcessSchedulerSimulations', JSON.stringify(savedSims));
    
    // Update UI
    loadSavedSimulations();
    
    // Show confirmation
    alert('Simulation saved successfully');
}

function loadSavedSimulations() {
    // Get simulations from localStorage
    const savedSims = JSON.parse(localStorage.getItem('preemptiveProcessSchedulerSimulations')) || [];
    
    // Update UI
    if (savedSims.length === 0) {
        noSavedMessage.style.display = 'block';
        return;
    }
    
    noSavedMessage.style.display = 'none';
    savedSimulations.innerHTML = '';
    
    savedSims.forEach(sim => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        item.innerHTML = `
            <div class="saved-item-info">
                <strong>${sim.name}</strong>
                <span>Algorithm: ${getAlgorithmName(sim.algorithm)}${sim.timeQuantum ? ` (TQ: ${sim.timeQuantum})` : ''}</span>
                <span>Processes: ${sim.processes.length}</span>
            </div>
            <div class="saved-item-actions">
                <button class="btn btn-primary btn-sm" onclick="loadSimulation(${sim.id})">Load</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSimulation(${sim.id})">Delete</button>
            </div>
        `;
        savedSimulations.appendChild(item);
    });
}

function getAlgorithmName(algorithm) {
    switch (algorithm) {
        case 'srtf': return 'Shortest Remaining Time First';
        case 'pp': return 'Preemptive Priority';
        case 'rr': return 'Round Robin';
        default: return algorithm;
    }
}

function loadSimulation(id) {
    // Get simulations from localStorage
    const savedSims = JSON.parse(localStorage.getItem('preemptiveProcessSchedulerSimulations')) || [];
    
    // Find simulation by id
    const simulation = savedSims.find(sim => sim.id === id);
    
    if (!simulation) {
        alert('Simulation not found');
        return;
    }
    
    // Load processes
    processes = JSON.parse(JSON.stringify(simulation.processes));
    renderProcessList();
    
    // Set algorithm
    algorithmSelect.value = simulation.algorithm;
    toggleTimeQuantum();
    
    if (simulation.timeQuantum) {
        timeQuantumInput.value = simulation.timeQuantum;
    }
    
    // Load results
    results = simulation.results;
    displayResults(results);
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function deleteSimulation(id) {
    if (!confirm('Are you sure you want to delete this simulation?')) {
        return;
    }
    
    // Get simulations from localStorage
    const savedSims = JSON.parse(localStorage.getItem('preemptiveProcessSchedulerSimulations')) || [];
    
    // Filter out the simulation to delete
    const updatedSims = savedSims.filter(sim => sim.id !== id);
    
    // Save to localStorage
    localStorage.setItem('preemptiveProcessSchedulerSimulations', JSON.stringify(updatedSims));
    
    // Update UI
    loadSavedSimulations();
}

// Make functions available globally
window.removeProcess = removeProcess;
window.loadSimulation = loadSimulation;
window.deleteSimulation = deleteSimulation;