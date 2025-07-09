class YearPlanner {
    constructor() {
        this.events = JSON.parse(localStorage.getItem('events') || '[]');
        this.tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        this.currentEditingEvent = null;
        this.currentEditingTask = null;
        this.userId = this.getUserId();
        this.cloudSyncEnabled = window.APP_CONFIG?.ENABLE_CLOUD_STORAGE || false;
        this.lastSyncTime = localStorage.getItem('lastSyncTime') || null;
        this.init();
    }

    async init() {
        this.updateCurrentDate();
        this.applySeason();
        this.setupEventListeners();
        
        // Load data from cloud if enabled
        if (this.cloudSyncEnabled) {
            await this.loadFromCloud();
        }
        
        this.renderTimeline();
        this.renderUnfinishedTasks();
        this.renderFutureOverview();
        this.renderEvents();
        this.renderTasks();
        this.renderDashboard();
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('sv-SE', options);
    }

    getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth() + 1;
        
        // Swedish seasons based on meteorological calendar
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    applySeason() {
        const season = this.getCurrentSeason();
        document.body.className = `season-${season}`;
        
        // Update header with seasonal greeting
        const seasonGreetings = {
            spring: '🌸 Vårens planering',
            summer: '☀️ Sommarens planering', 
            autumn: '🍂 Höstens planering',
            winter: '❄️ Vinterns planering'
        };
        
        const title = document.querySelector('.app-title');
        if (title) {
            title.textContent = seasonGreetings[season];
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('addEvent').addEventListener('click', () => this.openEventModal());
        document.getElementById('addTask').addEventListener('click', () => this.openTaskModal());
        
        document.getElementById('closeEventModal').addEventListener('click', () => this.closeEventModal());
        document.getElementById('closeTaskModal').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('closeFutureSummaryModal').addEventListener('click', () => this.closeFutureSummaryModal());
        
        document.getElementById('eventForm').addEventListener('submit', (e) => this.saveEvent(e));
        document.getElementById('taskForm').addEventListener('submit', (e) => this.saveTask(e));
        
        document.getElementById('addSubtask').addEventListener('click', () => this.addSubtaskInput());

        document.getElementById('eventRecurring').addEventListener('change', (e) => this.toggleRecurringEvent(e.target.checked));
        document.getElementById('taskRecurring').addEventListener('change', (e) => this.toggleRecurringTask(e.target.checked));

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    toggleRecurringEvent(isRecurring) {
        const dateRange = document.querySelector('.date-range');
        const fullDateRange = document.querySelector('.full-date-range');
        
        if (isRecurring) {
            dateRange.style.display = 'flex';
            fullDateRange.style.display = 'none';
        } else {
            dateRange.style.display = 'none';
            fullDateRange.style.display = 'flex';
        }
    }

    toggleRecurringTask(isRecurring) {
        const dateRange = document.querySelector('#taskForm .date-range');
        const fullDateRange = document.querySelector('#taskForm .full-date-range');
        
        if (isRecurring) {
            dateRange.style.display = 'block';
            fullDateRange.style.display = 'none';
        } else {
            dateRange.style.display = 'none';
            fullDateRange.style.display = 'block';
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    renderTimeline() {
        const container = document.getElementById('timeline');
        const now = new Date();
        const timeline = [];
        const ongoingEvents = this.getOngoingEvents(now);

        // Add ongoing events at the top if any
        if (ongoingEvents.length > 0) {
            timeline.push({
                date: now,
                events: ongoingEvents,
                tasks: [],
                isOngoing: true
            });
        }

        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() + i);
            
            const eventsForDay = this.getEventMarkersForDate(date);
            const tasksForDay = this.getTasksForDate(date);
            
            timeline.push({
                date: date,
                events: eventsForDay,
                tasks: tasksForDay,
                isOngoing: false
            });
        }

        container.innerHTML = timeline.map(day => {
            const hasItems = day.events.length > 0 || day.tasks.length > 0;
            if (!hasItems) return '';

            return `
                <div class="timeline-day">
                    <div class="timeline-date">${day.isOngoing ? 'Pågående' : this.formatTimelineDate(day.date)}</div>
                    <div class="timeline-events">
                        ${day.events.map(event => `
                            <div class="timeline-event" style="background: #e3f2fd;">
                                ${event.title} ${event.marker}
                            </div>
                        `).join('')}
                        ${day.tasks.map(task => `
                            <div class="timeline-event" style="background: #f3e5f5;">
                                ${task.title}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderUnfinishedTasks() {
        const container = document.getElementById('unfinishedTasks');
        const unfinishedTasks = this.tasks.filter(task => !this.isTaskCompleted(task));
        
        container.innerHTML = unfinishedTasks.map(task => {
            const completedSubtasks = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
            const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
            const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
            
            return `
                <div class="task-item">
                    <h3>${task.title}</h3>
                    <div class="task-due">${this.formatTaskDate(task)}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    
                    ${task.subtasks && task.subtasks.length > 0 ? `
                        <div class="task-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <small>${completedSubtasks}/${totalSubtasks} deluppgifter slutförda</small>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderFutureOverview() {
        const container = document.getElementById('futureTimeline');
        const now = new Date();
        const futureItems = [];

        for (let i = 1; i <= 3; i++) {
            const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthEvents = this.getEventsForMonth(month);
            const monthTasks = this.getTasksForMonth(month);
            const total = monthEvents.length + monthTasks.length;

            if (total > 0) {
                futureItems.push({
                    type: 'month',
                    date: month,
                    count: total,
                    title: month.toLocaleDateString('sv-SE', { month: 'long' })
                });
            }
        }

        const quarters = this.getQuarterlyOverview(now);
        
        container.innerHTML = [
            ...futureItems.map(item => `
                <div class="future-month" onclick="planner.showFutureSummary('month', '${item.date.getFullYear()}-${item.date.getMonth()}', '${item.title}')">
                    <h4>${item.title}</h4>
                    <div class="future-count">${item.count} ${item.count !== 1 ? 'objekt' : 'objekt'}</div>
                </div>
            `),
            ...quarters.map(quarter => `
                <div class="future-quarter" onclick="planner.showFutureSummary('quarter', '${quarter.year}-${quarter.quarter}', '${quarter.title}')">
                    <h4>${quarter.title}</h4>
                    <div class="future-count">${quarter.count} ${quarter.count !== 1 ? 'objekt' : 'objekt'}</div>
                </div>
            `)
        ].join('');
    }

    getQuarterlyOverview(now) {
        const quarters = [];
        const currentYear = now.getFullYear();
        const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

        for (let year = currentYear; year <= currentYear + 1; year++) {
            const startQuarter = (year === currentYear) ? currentQuarter + 1 : 1;
            const endQuarter = 4;

            for (let q = startQuarter; q <= endQuarter; q++) {
                const startMonth = (q - 1) * 3;
                const endMonth = startMonth + 2;
                
                let totalItems = 0;
                for (let m = startMonth; m <= endMonth; m++) {
                    const month = new Date(year, m, 1);
                    if (month > new Date(currentYear, now.getMonth() + 3, 1)) {
                        totalItems += this.getEventsForMonth(month).length + this.getTasksForMonth(month).length;
                    }
                }

                if (totalItems > 0) {
                    quarters.push({
                        title: `${year} Q${q}`,
                        count: totalItems,
                        year: year,
                        quarter: q
                    });
                }
            }
        }

        return quarters;
    }

    getEventsForDate(date) {
        return this.events.filter(event => {
            if (event.recurring) {
                const eventStart = this.parseMonthDay(event.startDate);
                const eventEnd = event.endDate ? this.parseMonthDay(event.endDate) : eventStart;
                const currentMonthDay = { month: date.getMonth() + 1, day: date.getDate() };
                
                return this.isDateInRange(currentMonthDay, eventStart, eventEnd);
            } else {
                const eventDate = new Date(event.startDate);
                return this.isSameDay(date, eventDate);
            }
        });
    }

    getEventMarkersForDate(date) {
        return this.events.filter(event => {
            if (event.recurring) {
                const eventStart = this.parseMonthDay(event.startDate);
                const eventEnd = event.endDate ? this.parseMonthDay(event.endDate) : eventStart;
                const currentMonthDay = { month: date.getMonth() + 1, day: date.getDate() };
                
                // For single-day events, show normally
                if (!event.endDate || (eventStart.month === eventEnd.month && eventStart.day === eventEnd.day)) {
                    return this.isDateInRange(currentMonthDay, eventStart, eventEnd);
                }
                
                // For multi-day events, only show on start and end dates
                return (eventStart.month === currentMonthDay.month && eventStart.day === currentMonthDay.day) ||
                       (eventEnd.month === currentMonthDay.month && eventEnd.day === currentMonthDay.day);
            } else {
                const eventStartDate = new Date(event.startDate);
                const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate;
                
                // For single-day events, show normally
                if (!event.endDate || this.isSameDay(eventStartDate, eventEndDate)) {
                    return this.isSameDay(date, eventStartDate);
                }
                
                // For multi-day events, only show on start and end dates
                return this.isSameDay(date, eventStartDate) || this.isSameDay(date, eventEndDate);
            }
        }).map(event => {
            let marker = '';
            
            if (event.recurring) {
                const eventStart = this.parseMonthDay(event.startDate);
                const eventEnd = event.endDate ? this.parseMonthDay(event.endDate) : eventStart;
                const currentMonthDay = { month: date.getMonth() + 1, day: date.getDate() };
                
                if (event.endDate && !(eventStart.month === eventEnd.month && eventStart.day === eventEnd.day)) {
                    if (eventStart.month === currentMonthDay.month && eventStart.day === currentMonthDay.day) {
                        marker = 'Början';
                    } else if (eventEnd.month === currentMonthDay.month && eventEnd.day === currentMonthDay.day) {
                        marker = 'Slut';
                    }
                }
            } else {
                const eventStartDate = new Date(event.startDate);
                const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate;
                
                if (event.endDate && !this.isSameDay(eventStartDate, eventEndDate)) {
                    if (this.isSameDay(date, eventStartDate)) {
                        marker = 'Början';
                    } else if (this.isSameDay(date, eventEndDate)) {
                        marker = 'Slut';
                    }
                }
            }
            
            return {
                ...event,
                marker: marker
            };
        });
    }

    getOngoingEvents(currentDate) {
        const ongoingEvents = [];
        
        this.events.forEach(event => {
            if (event.endDate) {
                let isOngoing = false;
                let startDate;
                
                if (event.recurring) {
                    const eventStart = this.parseMonthDay(event.startDate);
                    const eventEnd = this.parseMonthDay(event.endDate);
                    const currentMonthDay = { month: currentDate.getMonth() + 1, day: currentDate.getDate() };
                    
                    // Check if current date is within the event range
                    if (this.isDateInRange(currentMonthDay, eventStart, eventEnd)) {
                        isOngoing = true;
                        
                        // Check if event started in the past (for "Ongoing" marker)
                        const currentYear = currentDate.getFullYear();
                        const eventStartThisYear = new Date(currentYear, eventStart.month - 1, eventStart.day);
                        
                        if (currentDate > eventStartThisYear) {
                            startDate = eventStartThisYear;
                        }
                    }
                } else {
                    const eventStartDate = new Date(event.startDate);
                    const eventEndDate = new Date(event.endDate);
                    
                    if (currentDate >= eventStartDate && currentDate <= eventEndDate) {
                        isOngoing = true;
                        
                        if (currentDate > eventStartDate) {
                            startDate = eventStartDate;
                        }
                    }
                }
                
                if (isOngoing) {
                    ongoingEvents.push({
                        ...event,
                        marker: startDate ? `(${this.formatShortDate(startDate)}) Pågående` : 'Pågående'
                    });
                }
            }
        });
        
        return ongoingEvents;
    }

    formatShortDate(date) {
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    }

    getTasksForDate(date) {
        return this.tasks.filter(task => {
            if (task.recurring) {
                const taskDate = this.parseMonthDay(task.dueDate);
                const currentMonthDay = { month: date.getMonth() + 1, day: date.getDate() };
                
                return taskDate.month === currentMonthDay.month && taskDate.day === currentMonthDay.day;
            } else {
                const taskDate = new Date(task.dueDate);
                return this.isSameDay(date, taskDate);
            }
        });
    }

    getEventsForMonth(date) {
        const month = date.getMonth() + 1;
        return this.events.filter(event => {
            if (event.recurring) {
                const eventStart = this.parseMonthDay(event.startDate);
                const eventEnd = event.endDate ? this.parseMonthDay(event.endDate) : eventStart;
                
                return eventStart.month === month || eventEnd.month === month ||
                       (eventStart.month < month && eventEnd.month > month);
            } else {
                const eventDate = new Date(event.startDate);
                return eventDate.getMonth() + 1 === month;
            }
        });
    }

    getTasksForMonth(date) {
        const month = date.getMonth() + 1;
        return this.tasks.filter(task => {
            if (task.recurring) {
                const taskDate = this.parseMonthDay(task.dueDate);
                return taskDate.month === month;
            } else {
                const taskDate = new Date(task.dueDate);
                return taskDate.getMonth() + 1 === month;
            }
        });
    }

    parseMonthDay(dateString) {
        const parts = dateString.split('-');
        return {
            month: parseInt(parts[0], 10),
            day: parseInt(parts[1], 10)
        };
    }

    isDateInRange(date, start, end) {
        if (start.month === end.month) {
            return date.month === start.month && date.day >= start.day && date.day <= end.day;
        } else {
            return (date.month === start.month && date.day >= start.day) ||
                   (date.month === end.month && date.day <= end.day) ||
                   (date.month > start.month && date.month < end.month);
        }
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    formatTimelineDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (this.isSameDay(date, today)) {
            return 'Idag';
        } else if (this.isSameDay(date, tomorrow)) {
            return 'Imorgon';
        } else {
            return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
        }
    }

    formatTaskDate(task) {
        if (task.recurring) {
            const parsed = this.parseMonthDay(task.dueDate);
            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
            return `${monthNames[parsed.month]} ${parsed.day} (årligen)`;
        } else {
            return this.formatDate(task.dueDate);
        }
    }

    renderEvents() {
        const container = document.getElementById('eventList');
        const sortedEvents = this.events.sort((a, b) => {
            if (a.recurring && b.recurring) {
                const aStart = this.parseMonthDay(a.startDate);
                const bStart = this.parseMonthDay(b.startDate);
                return aStart.month - bStart.month || aStart.day - bStart.day;
            } else if (a.recurring) {
                return -1;
            } else if (b.recurring) {
                return 1;
            } else {
                return new Date(a.startDate) - new Date(b.startDate);
            }
        });
        
        container.innerHTML = sortedEvents.map(event => `
            <div class="event-item">
                <h3>${event.title}</h3>
                <div class="event-date">${this.formatEventDate(event)}</div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                <div class="item-actions">
                    <button class="edit-btn" onclick="planner.editEvent('${event.id}')">Redigera</button>
                    <button class="delete-btn" onclick="planner.deleteEvent('${event.id}')">Ta bort</button>
                </div>
            </div>
        `).join('');
    }

    formatEventDate(event) {
        if (event.recurring) {
            const start = this.parseMonthDay(event.startDate);
            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
            
            if (event.endDate) {
                const end = this.parseMonthDay(event.endDate);
                return `${monthNames[start.month]} ${start.day} - ${monthNames[end.month]} ${end.day} (årligen)`;
            } else {
                return `${monthNames[start.month]} ${start.day} (årligen)`;
            }
        } else {
            return this.formatDate(event.startDate);
        }
    }

    renderTasks() {
        const container = document.getElementById('taskList');
        const sortedTasks = this.tasks.sort((a, b) => {
            if (a.recurring && b.recurring) {
                const aDate = this.parseMonthDay(a.dueDate);
                const bDate = this.parseMonthDay(b.dueDate);
                return aDate.month - bDate.month || aDate.day - bDate.day;
            } else if (a.recurring) {
                return -1;
            } else if (b.recurring) {
                return 1;
            } else {
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
        });
        
        container.innerHTML = sortedTasks.map(task => {
            const completedSubtasks = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
            const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
            const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
            
            return `
                <div class="task-item">
                    <h3>${task.title}</h3>
                    <div class="task-due">${this.formatTaskDate(task)}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    
                    ${task.subtasks && task.subtasks.length > 0 ? `
                        <div class="task-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <small>${completedSubtasks}/${totalSubtasks} deluppgifter slutförda</small>
                        </div>
                        <div class="subtasks">
                            ${task.subtasks.map(subtask => `
                                <div class="subtask-item">
                                    <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                                           onchange="planner.toggleSubtask('${task.id}', '${subtask.id}')">
                                    <span style="${subtask.completed ? 'text-decoration: line-through; color: #999;' : ''}">${subtask.title}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="item-actions">
                        <button class="edit-btn" onclick="planner.editTask('${task.id}')">Redigera</button>
                        <button class="delete-btn" onclick="planner.deleteTask('${task.id}')">Ta bort</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDashboard() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        
        const currentMonthTasks = this.getTasksForMonth(now);
        const prevMonthTasks = this.getTasksForMonth(new Date(now.getFullYear(), prevMonth, 1));
        
        this.renderMonthChart('prevMonthChart', prevMonthTasks, prevMonth);
        this.renderMonthChart('currentMonthChart', currentMonthTasks, currentMonth);
    }

    renderMonthChart(containerId, tasks, month) {
        const container = document.getElementById(containerId);
        const completedTasks = tasks.filter(task => this.isTaskCompleted(task)).length;
        const totalTasks = tasks.length;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 2rem; color: #667eea; margin-bottom: 1rem;">${percentage}%</div>
                <div style="margin-bottom: 1rem;">${completedTasks} av ${totalTasks} uppgifter slutförda</div>
                <div style="font-size: 0.9rem; color: #666;">${monthNames[month]} ${new Date().getFullYear()}</div>
            </div>
        `;
    }

    isTaskCompleted(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            return task.completed || false;
        }
        return task.subtasks.every(subtask => subtask.completed);
    }

    openEventModal(event = null) {
        this.currentEditingEvent = event;
        const modal = document.getElementById('eventModal');
        const title = document.getElementById('eventModalTitle');
        const form = document.getElementById('eventForm');
        
        if (event) {
            title.textContent = 'Redigera händelse';
            document.getElementById('eventTitle').value = event.title;
            document.getElementById('eventRecurring').checked = event.recurring !== false;
            
            if (event.recurring !== false) {
                document.getElementById('eventStartDate').value = event.startDate;
                document.getElementById('eventEndDate').value = event.endDate || '';
                this.toggleRecurringEvent(true);
            } else {
                document.getElementById('eventFullStartDate').value = event.startDate;
                document.getElementById('eventFullEndDate').value = event.endDate || '';
                this.toggleRecurringEvent(false);
            }
            
            document.getElementById('eventDescription').value = event.description || '';
        } else {
            title.textContent = 'Lägg till händelse';
            form.reset();
            document.getElementById('eventRecurring').checked = true;
            this.toggleRecurringEvent(true);
        }
        
        modal.style.display = 'block';
    }

    closeEventModal() {
        document.getElementById('eventModal').style.display = 'none';
        this.currentEditingEvent = null;
    }

    openTaskModal(task = null) {
        this.currentEditingTask = task;
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const form = document.getElementById('taskForm');
        
        if (task) {
            title.textContent = 'Redigera uppgift';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskRecurring').checked = task.recurring !== false;
            
            if (task.recurring !== false) {
                document.getElementById('taskDueDate').value = task.dueDate;
                this.toggleRecurringTask(true);
            } else {
                document.getElementById('taskFullDueDate').value = task.dueDate;
                this.toggleRecurringTask(false);
            }
            
            document.getElementById('taskDescription').value = task.description || '';
            this.renderSubtaskInputs(task.subtasks || []);
        } else {
            title.textContent = 'Lägg till uppgift';
            form.reset();
            document.getElementById('taskRecurring').checked = true;
            this.toggleRecurringTask(true);
            this.renderSubtaskInputs([]);
        }
        
        modal.style.display = 'block';
    }

    closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.currentEditingTask = null;
    }

    renderSubtaskInputs(subtasks = []) {
        const container = document.getElementById('subtaskList');
        container.innerHTML = subtasks.map((subtask, index) => `
            <div class="subtask-input">
                <input type="text" value="${subtask.title}" placeholder="Deluppgiftstitel" required>
                <button type="button" onclick="this.parentElement.remove()">Ta bort</button>
            </div>
        `).join('');
    }

    addSubtaskInput() {
        const container = document.getElementById('subtaskList');
        const div = document.createElement('div');
        div.className = 'subtask-input';
        div.innerHTML = `
            <input type="text" placeholder="Deluppgiftstitel" required>
            <button type="button" onclick="this.parentElement.remove()">Ta bort</button>
        `;
        container.appendChild(div);
    }

    saveEvent(e) {
        e.preventDefault();
        const title = document.getElementById('eventTitle').value;
        const recurring = document.getElementById('eventRecurring').checked;
        const description = document.getElementById('eventDescription').value;
        
        let startDate, endDate;
        if (recurring) {
            startDate = document.getElementById('eventStartDate').value;
            endDate = document.getElementById('eventEndDate').value;
        } else {
            startDate = document.getElementById('eventFullStartDate').value;
            endDate = document.getElementById('eventFullEndDate').value;
        }
        
        if (this.currentEditingEvent) {
            this.currentEditingEvent.title = title;
            this.currentEditingEvent.startDate = startDate;
            this.currentEditingEvent.endDate = endDate;
            this.currentEditingEvent.description = description;
            this.currentEditingEvent.recurring = recurring;
        } else {
            this.events.push({
                id: this.generateId(),
                title,
                startDate,
                endDate,
                description,
                recurring
            });
        }
        
        this.saveToStorage();
        this.renderEvents();
        this.renderTimeline();
        this.renderFutureOverview();
        this.closeEventModal();
    }

    saveTask(e) {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value;
        const recurring = document.getElementById('taskRecurring').checked;
        const description = document.getElementById('taskDescription').value;
        
        let dueDate;
        if (recurring) {
            dueDate = document.getElementById('taskDueDate').value;
        } else {
            dueDate = document.getElementById('taskFullDueDate').value;
        }
        
        const subtaskInputs = document.querySelectorAll('#subtaskList .subtask-input input');
        const subtasks = Array.from(subtaskInputs)
            .map(input => input.value.trim())
            .filter(title => title)
            .map(title => ({
                id: this.generateId(),
                title,
                completed: false
            }));
        
        if (this.currentEditingTask) {
            this.currentEditingTask.title = title;
            this.currentEditingTask.dueDate = dueDate;
            this.currentEditingTask.description = description;
            this.currentEditingTask.subtasks = subtasks;
            this.currentEditingTask.recurring = recurring;
        } else {
            this.tasks.push({
                id: this.generateId(),
                title,
                dueDate,
                description,
                subtasks,
                completed: false,
                recurring
            });
        }
        
        this.saveToStorage();
        this.renderTasks();
        this.renderTimeline();
        this.renderUnfinishedTasks();
        this.renderFutureOverview();
        this.renderDashboard();
        this.closeTaskModal();
    }

    editEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            this.openEventModal(event);
        }
    }

    deleteEvent(eventId) {
        if (confirm('Är du säker på att du vill ta bort denna händelse?')) {
            this.events = this.events.filter(e => e.id !== eventId);
            this.saveToStorage();
            this.renderEvents();
            this.renderTimeline();
            this.renderFutureOverview();
        }
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.openTaskModal(task);
        }
    }

    deleteTask(taskId) {
        if (confirm('Är du säker på att du vill ta bort denna uppgift?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveToStorage();
            this.renderTasks();
            this.renderTimeline();
            this.renderUnfinishedTasks();
            this.renderFutureOverview();
            this.renderDashboard();
        }
    }

    toggleSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const subtask = task.subtasks.find(st => st.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                this.saveToStorage();
                this.renderTasks();
                this.renderUnfinishedTasks();
                this.renderDashboard();
            }
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showFutureSummary(type, identifier, title) {
        const modal = document.getElementById('futureSummaryModal');
        const modalTitle = document.getElementById('futureSummaryTitle');
        const eventsContainer = document.getElementById('futureEventsList');
        const tasksContainer = document.getElementById('futureTasksList');
        
        modalTitle.textContent = title;
        
        let events = [];
        let tasks = [];
        
        if (type === 'month') {
            const [year, month] = identifier.split('-').map(Number);
            const date = new Date(year, month, 1);
            events = this.getEventsForMonth(date);
            tasks = this.getTasksForMonth(date);
        } else if (type === 'quarter') {
            const [year, quarter] = identifier.split('-').map(Number);
            const startMonth = (quarter - 1) * 3;
            const endMonth = startMonth + 2;
            
            for (let m = startMonth; m <= endMonth; m++) {
                const date = new Date(year, m, 1);
                events = events.concat(this.getEventsForMonth(date));
                tasks = tasks.concat(this.getTasksForMonth(date));
            }
        }
        
        // Remove duplicates
        events = events.filter((event, index, self) => 
            index === self.findIndex(e => e.id === event.id)
        );
        tasks = tasks.filter((task, index, self) => 
            index === self.findIndex(t => t.id === task.id)
        );
        
        eventsContainer.innerHTML = events.length > 0 ? events.map(event => `
            <div class="summary-item">
                <div class="summary-item-title">${event.title}</div>
                <div class="summary-item-date">${this.formatEventDate(event)}</div>
                ${event.description ? `<div class="summary-item-description">${event.description}</div>` : ''}
            </div>
        `).join('') : '<div class="no-items">Inga händelser planerade</div>';
        
        tasksContainer.innerHTML = tasks.length > 0 ? tasks.map(task => `
            <div class="summary-item">
                <div class="summary-item-title">${task.title}</div>
                <div class="summary-item-date">${this.formatTaskDate(task)}</div>
                ${task.description ? `<div class="summary-item-description">${task.description}</div>` : ''}
                ${task.subtasks && task.subtasks.length > 0 ? `
                    <div class="summary-subtasks">
                        ${task.subtasks.slice(0, 3).map(subtask => `
                            <span class="summary-subtask">${subtask.title}</span>
                        `).join('')}
                        ${task.subtasks.length > 3 ? `<span class="summary-more">+${task.subtasks.length - 3} fler</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('') : '<div class="no-items">Inga uppgifter planerade</div>';
        
        modal.style.display = 'block';
    }
    
    closeFutureSummaryModal() {
        document.getElementById('futureSummaryModal').style.display = 'none';
    }

    saveToStorage() {
        localStorage.setItem('events', JSON.stringify(this.events));
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
        
        // Auto-sync to cloud if enabled
        if (this.cloudSyncEnabled) {
            this.saveToCloud();
        }
    }

    getUserId() {
        // Use fixed user ID for simplified data sharing across devices
        return 'swedish-year-planner-user';
    }

    async loadFromCloud() {
        if (!window.APP_CONFIG?.API_BASE_URL) {
            console.log('Molnlagring ej tillgänglig: API URL saknas');
            return;
        }

        try {
            const [eventsResponse, tasksResponse] = await Promise.all([
                fetch(`${window.APP_CONFIG.API_BASE_URL}/api/events`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': this.userId
                    }
                }),
                fetch(`${window.APP_CONFIG.API_BASE_URL}/api/tasks`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': this.userId
                    }
                })
            ]);

            if (eventsResponse.ok && tasksResponse.ok) {
                const cloudEvents = await eventsResponse.json();
                const cloudTasks = await tasksResponse.json();
                
                // Only update if cloud has data
                if (cloudEvents.length > 0 || cloudTasks.length > 0) {
                    this.events = cloudEvents;
                    this.tasks = cloudTasks;
                    
                    // Update local storage
                    localStorage.setItem('events', JSON.stringify(this.events));
                    localStorage.setItem('tasks', JSON.stringify(this.tasks));
                    localStorage.setItem('lastSyncTime', new Date().toISOString());
                    
                    console.log('Data laddad från molnet');
                }
            }
        } catch (error) {
            console.error('Kunde inte ladda från molnet:', error);
            // Continue with local data on error
        }
    }

    async saveToCloud() {
        if (!window.APP_CONFIG?.API_BASE_URL) {
            return;
        }

        try {
            const [eventsResponse, tasksResponse] = await Promise.all([
                fetch(`${window.APP_CONFIG.API_BASE_URL}/api/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': this.userId
                    },
                    body: JSON.stringify(this.events)
                }),
                fetch(`${window.APP_CONFIG.API_BASE_URL}/api/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': this.userId
                    },
                    body: JSON.stringify(this.tasks)
                })
            ]);

            if (eventsResponse.ok && tasksResponse.ok) {
                localStorage.setItem('lastSyncTime', new Date().toISOString());
                console.log('Data sparad i molnet');
            } else {
                console.error('Kunde inte spara till molnet');
            }
        } catch (error) {
            console.error('Fel vid sparning till molnet:', error);
            // Data is still saved locally, so continue
        }
    }

    async exportBackup() {
        if (!window.APP_CONFIG?.API_BASE_URL) {
            // Fallback to local export
            const data = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                data: {
                    events: this.events,
                    tasks: this.tasks
                }
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `arsplanerare-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            return;
        }

        try {
            const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/backup`, {
                method: 'GET',
                headers: {
                    'X-User-ID': this.userId
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `arsplanerare-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Kunde inte exportera backup:', error);
        }
    }
}

const planner = new YearPlanner();