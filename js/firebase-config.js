// js/firebase-config.js

// Importa las funciones que necesitas de los SDKs que necesitas
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: Reemplaza lo siguiente con la configuración de tu proyecto de Firebase
// La configuración de tu aplicación web de Firebase
    const firebaseConfig = {
    apiKey: "AIzaSyC0FfmohC4OPaVR0fyRQwbe13ZPGEB1kWI",
    authDomain: "evaluaplus-app-a4cea.firebaseapp.com",
    projectId: "evaluaplus-app-a4cea",
    storageBucket: "evaluaplus-app-a4cea.firebasestorage.app",
    messagingSenderId: "1098079339045",
    appId: "1:1098079339045:web:f4c193aaf59e1831d0b5cc"
    };


// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios de Firebase que usaremos en otras partes de la aplicación
export const auth = getAuth(app);
export const db = getFirestore(app);