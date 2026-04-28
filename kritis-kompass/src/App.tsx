import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AssessmentProvider } from './context/AssessmentContext';
import { SplashView } from './views/SplashView';
import { CheckView } from './views/CheckView';
import { AssessmentView } from './views/AssessmentView';
import { ReportView } from './views/ReportView';
import { PrivacyView } from './views/PrivacyView';

export function App() {
  return (
    <AssessmentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashView />} />
          <Route path="/check" element={<CheckView />} />
          <Route path="/assessment" element={<AssessmentView />} />
          <Route path="/report" element={<ReportView />} />
          <Route path="/privacy" element={<PrivacyView />} />
        </Routes>
      </BrowserRouter>
    </AssessmentProvider>
  );
}
