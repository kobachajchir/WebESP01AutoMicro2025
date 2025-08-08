import React, { useRef, useState } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext';

export default function Login() {

  const { send } = useWebSocket();
  const [valid, isValid] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  //@ts-ignore
  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Aquí podrías validar el input en tiempo real si es necesario, hay que validar user y password
    const username = userRef.current?.value || '';
    const password = passwordRef.current?.value || '';
    //password debe tener al menos 4 caracteres y username al menos 4 tambien
    isValid(username.length >= 4 && password.length >= 4);
  }

  function sendLoginAttempt() {
    // Aquí iría la lógica para enviar el intento de inicio de sesión
    // Por ejemplo, enviar un mensaje al WebSocket
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    send('login_attempt', { username, password });
    console.log('Intento de inicio de sesión enviado:', { username, password });
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-full w-full flex items-center justify-center flex-col">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto lg:py-0">
        <a
          href="#"
          className="flex items-center mb-6 text-2xl font-semibold text-gray-900 dark:text-white"
        >
          <img
            className="w-8 h-8 mr-2"
            src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/logo.svg"
            alt="logo"
          />
          Servidor ESP01
        </a>
        <div className="w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md xl:p-0 dark:bg-gray-800 dark:border-gray-700 my-6">
          <div className="p-6 space-y-4 sm:p-8">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-gray-900 md:text-xl dark:text-white">
              Iniciar sesion
            </h1>
            <form className="space-y-4 md:space-y-6" action="#">
              <div className="flex flex-col justify-start items-start">
                <label
                  htmlFor="username"
                  className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Usuario
                </label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="Ingrese su usuario"
                  onChange={onInputChange}
                  ref={userRef}
                  required={false}
                />
              </div>
              <div className="flex flex-col justify-start items-start">
                <label
                  htmlFor="password"
                  className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  placeholder="••••••••"
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  onChange={onInputChange}
                  ref={passwordRef}
                  required={false}
                />
              </div>
              <div className="flex items-center justify-between">
                <a
                  href="#"
                  className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-500"
                >
                  Olvido su contraseña?
                </a>
              </div>
              <button
                type="button"
                onClick={sendLoginAttempt}
                disabled={!valid}
                className="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 disabled:focus:ring-red-300"
              >
                Iniciar sesion
              </button>
            </form>
          </div>
        </div>
      </div>
      <footer className='w-full fixed bottom-0'>
        <div className="text-center p-1 bg-gray-800 text-white">
          Auto Microcontroladores 2025 - Koba Chajchir
        </div>
      </footer>
    </div>
  );
}
