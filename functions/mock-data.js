/**
 * Mock data for testing
 */

const mockEvents = [
  {
    title: 'Midsummer Celebration',
    date: '2025-06-21',
    type: 'holiday',
    description: 'Traditional Swedish midsummer celebration'
  },
  {
    title: 'Summer Vacation',
    date: '2025-07-15',
    type: 'personal',
    description: 'Family vacation to Gotland'
  },
  {
    title: 'Back to School',
    date: '2025-08-20',
    type: 'important',
    description: 'Children start new school year'
  },
  {
    title: 'Conference',
    date: '2025-09-10',
    type: 'work',
    description: 'Tech conference in Stockholm'
  },
  {
    title: 'Halloween',
    date: '2025-10-31',
    type: 'holiday',
    description: 'Halloween celebration'
  },
  {
    title: 'Christmas',
    date: '2025-12-25',
    type: 'holiday',
    description: 'Christmas celebration'
  }
];

const mockTasks = [
  {
    title: 'Plan midsummer party',
    deadline: '2025-06-15',
    completed: false,
    priority: 'high',
    description: 'Organize midsummer celebration'
  },
  {
    title: 'Book vacation rental',
    deadline: '2025-06-01',
    completed: true,
    priority: 'high',
    description: 'Book summer house in Gotland'
  },
  {
    title: 'Buy school supplies',
    deadline: '2025-08-10',
    completed: false,
    priority: 'medium',
    description: 'Get books and supplies for new school year'
  },
  {
    title: 'Prepare conference presentation',
    deadline: '2025-09-05',
    completed: false,
    priority: 'high',
    description: 'Prepare slides for tech conference'
  },
  {
    title: 'Halloween costume',
    deadline: '2025-10-25',
    completed: false,
    priority: 'low',
    description: 'Get Halloween costume for kids'
  },
  {
    title: 'Christmas shopping',
    deadline: '2025-12-20',
    completed: false,
    priority: 'medium',
    description: 'Buy Christmas presents'
  }
];

const mockUsers = [
  {
    id: 'swedish-year-planner-user',
    name: 'Test User',
    settings: {
      theme: 'light',
      language: 'sv',
      notifications: true
    }
  },
  {
    id: 'testuser1',
    name: 'Test User 1',
    settings: {
      theme: 'dark',
      language: 'sv',
      notifications: false
    }
  },
  {
    id: 'testuser2',
    name: 'Test User 2',
    settings: {
      theme: 'light',
      language: 'en',
      notifications: true
    }
  }
];

const mockAnalytics = {
  events: {
    total: 6,
    byType: {
      holiday: 3,
      personal: 1,
      work: 1,
      important: 1
    },
    byMonth: {
      '2025-06': 1,
      '2025-07': 1,
      '2025-08': 1,
      '2025-09': 1,
      '2025-10': 1,
      '2025-12': 1
    }
  },
  tasks: {
    total: 6,
    completed: 1,
    pending: 5,
    byPriority: {
      high: 3,
      medium: 2,
      low: 1
    },
    completionRate: 16.67
  }
};

const mockBackup = {
  timestamp: '2025-07-09T10:00:00Z',
  version: '1.0.0',
  user: 'swedish-year-planner-user',
  events: mockEvents,
  tasks: mockTasks,
  settings: {
    theme: 'light',
    language: 'sv',
    notifications: true
  }
};

// Helper functions for generating test data
function generateRandomEvent() {
  const types = ['holiday', 'personal', 'work', 'important'];
  const titles = [
    'Team Meeting',
    'Doctor Appointment',
    'Birthday Party',
    'Conference Call',
    'Vacation',
    'Project Deadline',
    'Family Dinner',
    'Workshop'
  ];
  
  const randomDate = new Date();
  randomDate.setDate(randomDate.getDate() + Math.floor(Math.random() * 365));
  
  return {
    title: titles[Math.floor(Math.random() * titles.length)],
    date: randomDate.toISOString().split('T')[0],
    type: types[Math.floor(Math.random() * types.length)],
    description: `Generated test event for ${randomDate.toDateString()}`
  };
}

function generateRandomTask() {
  const priorities = ['high', 'medium', 'low'];
  const titles = [
    'Complete project',
    'Review documents',
    'Call client',
    'Update website',
    'Prepare presentation',
    'Send emails',
    'Schedule meeting',
    'Write report'
  ];
  
  const randomDate = new Date();
  randomDate.setDate(randomDate.getDate() + Math.floor(Math.random() * 30));
  
  return {
    title: titles[Math.floor(Math.random() * titles.length)],
    deadline: randomDate.toISOString().split('T')[0],
    completed: Math.random() > 0.7,
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    description: `Generated test task due ${randomDate.toDateString()}`
  };
}

function generateTestData(eventCount = 10, taskCount = 15) {
  const events = Array.from({ length: eventCount }, generateRandomEvent);
  const tasks = Array.from({ length: taskCount }, generateRandomTask);
  
  return {
    events: events.sort((a, b) => new Date(a.date) - new Date(b.date)),
    tasks: tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  };
}

module.exports = {
  mockEvents,
  mockTasks,
  mockUsers,
  mockAnalytics,
  mockBackup,
  generateRandomEvent,
  generateRandomTask,
  generateTestData
};