// js/script.js

// --- ¡NUEVAS IMPORTACIONES PARA LA REDIRECCIÓN INTELIGENTE! ---
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LÓGICA ORIGINAL DE LA PÁGINA DE INICIO (DEMO INTERACTIVA) ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 800,
        once: true,
        offset: 50,
    });

    feather.replace();

    const subjectTabs = document.querySelectorAll('.subject-tab');
    const questionCards = document.querySelectorAll('.question-card');

    subjectTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const currentActiveCard = document.querySelector('.question-card.active');
            if (currentActiveCard) {
                currentActiveCard.classList.remove('active');
            }
            
            subjectTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const subject = tab.dataset.subject;
            const activeQuestionCard = document.getElementById(`${subject}-q`);
            
            setTimeout(() => {
                if (activeQuestionCard) {
                    activeQuestionCard.classList.add('active');
                }
            }, 150);
        });
    });

    const questionForms = document.querySelectorAll('.question-form');
    const progressBar = document.querySelector('.progress-bar');
    let questionsAnswered = 0;
    const totalQuestions = questionForms.length;
    
    questionForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const feedbackEl = form.querySelector('.feedback');
            const selectedOption = form.querySelector('input[type="radio"]:checked');

            if (!selectedOption) {
                feedbackEl.innerHTML = '⚠️ Por favor, selecciona una opción.';
                feedbackEl.className = 'feedback warning';
                feedbackEl.style.display = 'block';
                return;
            }

            if (!form.dataset.answered) {
                questionsAnswered++;
                const progressPercentage = (questionsAnswered / totalQuestions) * 100;
                progressBar.style.width = `${progressPercentage}%`;
                form.dataset.answered = "true";
            }

            const isCorrect = selectedOption.value === form.dataset.correct;
            let feedbackText = '';
            let feedbackIcon = isCorrect ? '✔️' : '❌';

            if (form.querySelector('input[name="q1"]')) {
                feedbackText = isCorrect ? 
                    '¡Correcto! La metáfora establece que, al igual que un faro, el amor es una guía firme y perpetua.' :
                    'Incorrecto. La respuesta correcta es la C. El faro simboliza constancia y guía frente a los desafíos.';
            } else if (form.querySelector('input[name="q2"]')) {
                feedbackText = isCorrect ?
                    '¡Excelente! El RER está cubierto de ribosomas, que son los sitios de síntesis de proteínas para exportación.' :
                    'Incorrecto. La respuesta es la B. El RER es el especialista en procesar proteínas para exportar.';
            } else if (form.querySelector('input[name="q3"]')) {
                feedbackText = isCorrect ?
                    '¡Muy bien! La división del mundo en dos bloques (OTAN y Pacto de Varsovia) fue una consecuencia directa de la Guerra Fría.' :
                    'Incorrecto. La respuesta es la D. La formación de alianzas militares fue una consecuencia directa.';
            }

            feedbackEl.className = isCorrect ? 'feedback correct' : 'feedback wrong';
            feedbackEl.innerHTML = `${feedbackIcon} ${feedbackText}`;

            feedbackEl.style.display = 'block';
            feedbackEl.style.opacity = '0';
            feedbackEl.style.transform = 'translateY(10px)';
            setTimeout(() => {
                feedbackEl.style.opacity = '1';
                feedbackEl.style.transform = 'translateY(0)';
            }, 10);
        });
    });
});

// --- ¡NUEVA LÓGICA PARA LA REDIRECCIÓN INTELIGENTE! ---
/**
 * Inicializa el sistema de redirección inteligente en la página de inicio.
 * Verifica el estado de autenticación y ajusta los enlaces de acción.
 */
export const initializeRedirection = () => {
    // Seleccionamos todos los botones que deben redirigir al panel o al login.
    // Usamos una clase común 'smart-link' que debemos añadir en el HTML.
    const ctaButtons = document.querySelectorAll('.cta-button, .panel-button');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- USUARIO CON SESIÓN ACTIVA ---
            try {
                // Consultamos su rol en Firestore
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userRole = userDocSnap.data().rol;
                    
                    // Definimos el destino según el rol
                    const destination = userRole === 'docente' ? 'docente.html' : 'estudiante.html';

                    // Actualizamos todos los botones
                    ctaButtons.forEach(button => {
                        button.textContent = 'Ir a mi Panel';
                        button.href = destination; // Asignamos el enlace directo
                    });

                } else {
                    // Si no hay documento, por seguridad lo mandamos al login
                    ctaButtons.forEach(button => button.href = 'login.html');
                }
            } catch (error) {
                console.error("Error al obtener el rol del usuario:", error);
                ctaButtons.forEach(button => button.href = 'login.html');
            }

        } else {
            // --- USUARIO SIN SESIÓN ACTIVA ---
            // Nos aseguramos de que todos los botones lleven al login.
            ctaButtons.forEach(button => {
                // Verificamos el texto original para no cambiar los botones de los paneles
                if(button.classList.contains('panel-button')) {
                    // No hacemos nada, su href ya es '#' y el comportamiento por defecto es correcto
                } else {
                    button.href = 'login.html';
                }
            });
            
             // Asignamos el enlace de login a los botones de los paneles de forma explícita
            const teacherPanelButton = document.querySelector('.panel.interactive-card[data-aos="fade-right"] .panel-button');
            const studentPanelButton = document.querySelector('.panel.interactive-card[data-aos="fade-left"] .panel-button');
            if(teacherPanelButton) teacherPanelButton.href = 'login.html';
            if(studentPanelButton) studentPanelButton.href = 'login.html';
        }
    });
};