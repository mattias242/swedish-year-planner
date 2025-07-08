# Swedish Seasonal Year Planner

A beautiful, mobile-first web application for planning your year with Swedish seasonal themes. Perfect for managing recurring yearly events and tasks with an intuitive timeline view.

![Swedish Seasonal Year Planner](https://img.shields.io/badge/Status-Ready-brightgreen)

## ✨ Features

### 🎯 Core Functionality
- **Recurring Events & Tasks**: Default yearly recurrence with month/day format (MM-DD)
- **Multi-day Events**: Smart start/end markers instead of daily repetition
- **30-Day Timeline**: Shows current date plus next 30 days with events and tasks
- **Unfinished Tasks**: Always-visible section for incomplete work
- **Future Overview**: Collapsed monthly view (3 months) and quarterly grouping
- **Subtasks Support**: Tasks can have multiple subtasks with progress tracking

### 🌍 Swedish Seasonal Design
The app automatically adapts to Swedish meteorological seasons:

- **🌸 Vårens planering** (Spring: March-May) - Fresh greens and nature tones
- **☀️ Sommarens planering** (Summer: June-August) - Warm yellows and golden hues  
- **🍂 Höstens planering** (Autumn: September-November) - Rich oranges and autumn colors
- **❄️ Vinterns planering** (Winter: December-February) - Cool blues and winter whites

### 📱 User Experience
- **Mobile-First Design**: Optimized for smartphones and tablets
- **Progressive Web App**: Works offline with local storage
- **Intuitive Navigation**: Tab-based interface with seasonal theming
- **Interactive Future View**: Click month/quarter cards for detailed summaries
- **Dashboard Analytics**: Visual progress tracking for current and previous months

## 🚀 Getting Started

### Local Development
1. Clone this repository:
   ```bash
   git clone https://github.com/mattias242/swedish-year-planner.git
   cd swedish-year-planner
   ```

2. Start local development server:
   ```bash
   npm run dev
   # Or simply open index.html in your browser
   ```

### Deploy to Scaleway
For production deployment with serverless functions and object storage:

1. **Install prerequisites**: Terraform, AWS CLI, Node.js 18+
2. **Setup Scaleway credentials**:
   ```bash
   export SCW_ACCESS_KEY="your-access-key"
   export SCW_SECRET_KEY="your-secret-key"
   export SCW_DEFAULT_PROJECT_ID="your-project-id"
   ```
3. **Deploy**:
   ```bash
   ./deploy.sh prod
   ```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Usage

#### Creating Events
- Events default to yearly recurrence (12-25 for Christmas)
- Add start and end dates for multi-day events
- Toggle off "Recurring yearly" for one-time events

#### Managing Tasks  
- Tasks can have optional subtasks
- Progress tracking shows completion percentage
- Unfinished tasks always visible on home screen

#### Timeline Navigation
- View next 30 days with events and tasks
- Click future months/quarters for detailed summaries
- Ongoing events show with proper start dates

## 📋 Event Types

### Events
Things that happen but you're not directly involved with:
- Holidays and celebrations
- Other people's birthdays
- Public events and festivals
- Seasonal occurrences

### Tasks
Work you need to do:
- Personal projects
- Recurring maintenance
- Goals and objectives
- Work assignments

## 🎨 Seasonal Themes

The app automatically switches themes based on the current date:

| Season | Months | Colors | Feel |
|--------|--------|--------|------|
| Spring | Mar-May | Greens, fresh tones | Renewal, growth |
| Summer | Jun-Aug | Yellows, warm hues | Energy, brightness |
| Autumn | Sep-Nov | Oranges, earth tones | Harvest, preparation |
| Winter | Dec-Feb | Blues, cool whites | Reflection, planning |

## 💾 Data Storage

All data is stored locally in your browser using localStorage:
- No server required
- Data persists between sessions
- Export/import functionality (coming soon)

## 🛠 Technical Details

- **Pure HTML/CSS/JavaScript** - No frameworks or dependencies
- **Responsive Design** - Works on all screen sizes
- **Local Storage API** - Persistent data storage
- **Modern ES6+** - Clean, maintainable code
- **CSS Grid & Flexbox** - Modern layout techniques

## ☁️ Cloud Deployment

This app is ready for cloud deployment on Scaleway with:

- **Object Storage**: Static website hosting with CDN
- **Serverless Functions**: API backend with automatic scaling  
- **Data Persistence**: User data sync across devices
- **Backup System**: Automatic data backup and export
- **Analytics**: Usage tracking and insights

### Deployment Options

| Environment | Use Case | URL Pattern |
|-------------|----------|-------------|
| **Local** | Development | `localhost:8080` |
| **Staging** | Testing | `app-staging.scw.cloud` |
| **Production** | Live app | `app-prod.scw.cloud` |

## 🔮 Future Enhancements

- [x] Data export/import functionality ✅
- [x] Cloud deployment with Scaleway ✅
- [x] API backend with serverless functions ✅
- [ ] Calendar integration
- [ ] Push notifications
- [ ] Dark mode toggle
- [ ] Custom seasonal themes
- [ ] Multi-language support
- [ ] Mobile app (PWA)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Inspired by Swedish seasonal traditions
- Built with love for organized planning
- Designed for the Swedish lifestyle and calendar

---

**Made with ❤️ for organized Swedes everywhere**