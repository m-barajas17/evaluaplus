// js/auth.js

// Importamos los servicios de auth y db desde nuestro archivo de configuración
import { auth, db } from './firebase-config.js';

// Importamos las funciones específicas que necesitamos de los SDKs de Firebase
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LÓGICA DE REGISTRO ---

// Obtenemos la referencia al formulario de registro
const registerForm = document.querySelector('#register-form');

// Añadimos un 'escuchador' de eventos para cuando el formulario se intente enviar
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        // Prevenimos el comportamiento por defecto del formulario (que es recargar la página)
        e.preventDefault();
        
        // Obtenemos los valores de los campos del formulario
        const name = registerForm['name'].value;
        const email = registerForm['email'].value;
        const password = registerForm['password'].value;
        const role = registerForm['role'].value;

        try {
            // Usamos la función de Firebase para crear un nuevo usuario con email y contraseña
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // ¡Importante! Ahora guardamos la información adicional del usuario en Firestore.
            // Creamos un nuevo documento en la colección 'users' con el ID del usuario (uid).
            await setDoc(doc(db, "users", user.uid), {
                nombre: name,
                email: email,
                rol: role
            });
            
            // Mostramos una alerta de éxito y redirigimos al login
            alert('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
            window.location.href = 'login.html';

        } catch (error) {
            // Si ocurre un error, lo mostramos en la consola y en una alerta
            console.error("Error al registrar el usuario:", error);
            alert(`Ocurrió un error: ${error.message}`);
        }
    });
}


// --- LÓGICA DE INICIO DE SESIÓN ---

// Obtenemos la referencia al formulario de login
const loginForm = document.querySelector('#login-form');

// Añadimos el 'escuchador' para el evento de envío
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Obtenemos los valores de email y contraseña
        const email = loginForm['email'].value;
        const password = loginForm['password'].value;

        try {
            // Usamos la función de Firebase para iniciar sesión
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Si el inicio de sesión es exitoso, mostramos un mensaje y redirigimos a la página principal
            alert(`¡Bienvenido de vuelta!`);
            // Eventualmente, esto redirigirá a un panel de control (dashboard.html)
            window.location.href = 'index.html'; 

        } catch (error) {
            // Manejo de errores (ej. contraseña incorrecta, usuario no encontrado)
            console.error("Error al iniciar sesión:", error);
            alert(`Error al iniciar sesión: ${error.message}`);
        }
    });
}