import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import MarketingPage from './app/marketing-page';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Toaster } from 'sonner';
import TermsPage from './app/terms-of-service-page';
import SupportPage from './app/support-page';
import PrivacyPage from './app/privacy-page';
import CreateAttachmentContent from './components/create-attachment-content';
import CognitoPopupCallback from './app/cognito-popup-callback';
import AuthPopupStart from './app/auth-popup-start';
import GooglePopupCallback from './app/google-popup-callback';
import TaskView from './components/task-view';
import DeveloperInfoPage from './app/developer-info-page';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path='/' element={<MarketingPage />} />
        <Route path="/auth/popup-start" element={<AuthPopupStart />} />
        <Route path="/cognito/popup-callback" element={<CognitoPopupCallback />} />
        <Route path="/google/popup-callback" element={<GooglePopupCallback />} />
        <Route path='/terms-of-service' element={<TermsPage />} />
        <Route path='/support' element={<SupportPage />} />
        <Route path='/privacy-policy' element={<PrivacyPage />} />
        <Route path='/developer-info' element={<DeveloperInfoPage />} />
        <Route path='/create-attachment' element={<CreateAttachmentContent />} />
        <Route
          path='/student-task-view'
          element={<TaskView audience="student" />}
        />
        <Route
          path='/teacher-task-view'
          element={<TaskView audience="teacher" />}
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
