import React from 'react';
import ReactDOM from 'react-dom/client';
// Anek: one family drawn in matching Latin and Devanagari, bundled locally so
// it works offline on the clinic network. "standard" carries the weight and
// width axes; Devanagari only loads its (weight-only) file when Hindi text shows up.
import '@fontsource-variable/anek-latin/standard.css';
import '@fontsource-variable/anek-devanagari/wght.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// The server answers 401 once a session has ended (idle too long, signed out
// elsewhere, or the user was deactivated). Rather than handle that at every
// fetch call, tell the app once so it can return to the sign-in screen.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await nativeFetch(input, init);
  const url = typeof input === 'string' ? input : input.url;
  if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/login')) {
    window.dispatchEvent(new Event('clinic:signed-out'));
  }
  return res;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
