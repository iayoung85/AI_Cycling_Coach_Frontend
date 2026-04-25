import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import CalendarPage from './components/Calendar/CalendarPage';
import ListViewPage from './components/ListView/ListViewPage';
import RecurringPage from './components/Recurring/RecurringPage';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/list" element={<ListViewPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
