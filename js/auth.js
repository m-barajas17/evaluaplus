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
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LÓGICA DE REGISTRO (¡ACTUALIZADA!) ---
const registerForm = document.querySelector('#register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = registerForm['name'].value;
        const email = registerForm['email'].value;
        const password = registerForm['password'].value;
        const role = registerForm['role'].value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                nombre: name,
                email: email,
                rol: role
            });

            // =============================================
            // ¡MODIFICADO! (Paso 2.1) Se reemplaza alert() por Toastify de éxito.
            Toastify({
                text: "¡Cuenta creada con éxito! Redirigiendo a login...",
                duration: 3000,
                gravity: "top", 
                position: "right", 
                style: {
                    background: "linear-gradient(to right, #00b09b, #96c93d)", // Verde éxito
                },
                stopOnFocus: true, 
            }).showToast();
            // =============================================

            // Esperamos 3 segundos (la duración del toast) antes de redirigir
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);

        } catch (error) {
            console.error("Error al registrar el usuario:", error);
            
            // =============================================
            // ¡MODIFICADO! (Paso 2.2) Se reemplaza alert() por Toastify de error.
            Toastify({
                text: `Ocurrió un error: ${error.message}`,
                duration: 5000, // Los errores duran más para poder leerse
                gravity: "top",
                position: "right",
                style: {
                    background: "linear-gradient(to right, #e74c3c, #c0392b)", // Rojo error
                },
                stopOnFocus: true,
            }).showToast();
            // =============================================
        }
    });
}


// --- LÓGICA DE INICIO DE SESIÓN (¡ACTUALIZADA!) ---
const loginForm = document.querySelector('#login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['email'].value;
        const password = loginForm['password'].value;

        try {
            // 1. Autenticamos al usuario
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Consultamos su rol en Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            // 3. Verificamos si el documento existe y tiene datos
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const userRole = userData.rol; 

                // 4. Redirigimos basándonos en el rol
                if (userRole === 'docente') {
                    // =============================================
                    // ¡MODIFICADO! (Paso 2.3) Toast de bienvenida (Docente)
                    // Usamos userData.nombre para un saludo personalizado.
                    Toastify({
                        text: `¡Bienvenido, ${userData.nombre}!`,
                        duration: 2000,
                        gravity: "top",
                        position: "right",
                        style: {
                            // Usamos el gradiente de nuestro tema (definido en css/auth.css)
                            background: "linear-gradient(135deg, #38BDF8, #3730A3)",
                        },
                        stopOnFocus: true,
                    }).showToast();
                    // =============================================
                    setTimeout(() => { window.location.href = 'docente.html'; }, 2000);

                } else if (userRole === 'estudiante') {
                    // =============================================
                    // ¡MODIFICADO! (Paso 2.4) Toast de bienvenida (Estudiante)
                    Toastify({
                        text: `¡Bienvenido, ${userData.nombre}!`,
                        duration: 2000,
                        gravity: "top",
                        position: "right",
                        style: {
                            background: "linear-gradient(135deg, #38BDF8, #3730A3)",
                        },
                        stopOnFocus: true,
                    }).showToast();
                    // =============================================
                    setTimeout(() => { window.location.href = 'estudiante.html'; }, 2000);

                } else {
                    // =============================================
                    // ¡MODIFICADO! (Paso 2.5) Toast de error (Rol no determinado)
                    Toastify({
                        text: "No se pudo determinar tu rol. Redirigiendo a la página principal.",
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        style: {
                            background: "linear-gradient(to right, #e74c3c, #c0392b)", // Rojo error
                        },
                        stopOnFocus: true,
                    }).showToast();
                    // =============================================
                    setTimeout(() => { window.location.href = 'index.html'; }, 3000);
                }
            } else {
                // =============================================
                // ¡MODIFICADO! (Paso 2.6) Toast de error (Documento no encontrado)
                Toastify({
                    text: "Error: No se encontraron datos adicionales para este usuario.",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    style: {
                        background: "linear-gradient(to right, #e74c3c, #c0392b)", // Rojo error
                    },
                    stopOnFocus: true,
                }).showToast();
                // =============================================
                setTimeout(() => { window.location.href = 'index.html'; }, 3000);
            }

        } catch (error) {
            console.error("Error al iniciar sesión:", error);
            // =============================================
            // ¡MODIFICADO! (Paso 2.7) Toast de error (Error genérico de login)
            Toastify({
                text: `Error al iniciar sesión: ${error.message}`,
                duration: 5000,
                gravity: "top",
                position: "right",
                style: {
                    background: "linear-gradient(to right, #e74c3c, #c0392b)", // Rojo error
                },
                stopOnFocus: true,
            }).showToast();
            // =============================================
        }
    });
}