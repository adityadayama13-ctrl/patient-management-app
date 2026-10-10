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
