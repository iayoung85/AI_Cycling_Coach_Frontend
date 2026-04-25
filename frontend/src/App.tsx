import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import CalendarPage from './components/Calendar/CalendarPage';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
