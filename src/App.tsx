import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import CalendarPage from './components/Calendar/CalendarPage';
import RecurringPage from './components/Recurring/RecurringPage';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
