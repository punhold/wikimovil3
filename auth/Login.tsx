import { useState } from "react";
import { loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "../services/firebase";

type Mode = "login" | "register" | "reset";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const clearMessages = () => {
    setError("");
    setInfo("");
  };

  const handleEmailLogin = async () => {
    try {
      clearMessages();
      await loginWithEmail(email, pass);
      // AuthContext detecta login y App.tsx muestra la Wiki
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRegister = async () => {
    try {
      clearMessages();
      if (!name.trim()) {
        setError("Ingresá tu nombre.");
        return;
      }
      await registerWithEmail(email, pass, name.trim());
      setInfo("Cuenta creada. Ya podés ingresar.");
      setMode("login");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async () => {
    try {
      clearMessages();
      await resetPassword(email);
      setInfo("Te enviamos un email para restablecer la contraseña.");
      setMode("login");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      clearMessages();
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          WikiMovil 3
        </h2>

        <p className="text-sm text-gray-500 text-center mb-6">
          {mode === "login" && "Inicia sesión para continuar"}
          {mode === "register" && "Creá tu cuenta"}
          {mode === "reset" && "Recuperar contraseña"}
        </p>

        {/* Nombre (solo registro) */}
        {mode === "register" && (
          <input
            type="text"
            placeholder="Nombre y apellido"
            className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        {/* Email */}
        <input
          type="email"
          placeholder="Correo"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password (no en reset) */}
        {mode !== "reset" && (
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full mb-4 px-3 py-2 border rounded-lg text-sm"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        )}

        {/* Acción principal */}
        {mode === "login" && (
          <button
            onClick={handleEmailLogin}
            className="w-full mb-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Ingresar
          </button>
        )}

        {mode === "register" && (
          <button
            onClick={handleRegister}
            className="w-full mb-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Registrarse
          </button>
        )}

        {mode === "reset" && (
          <button
            onClick={handleResetPassword}
            className="w-full mb-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Enviar email de recuperación
          </button>
        )}

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full mb-3 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600"
        >
          Ingresar con Google
        </button>

        {/* Links pequeños */}
        <div className="flex items-center justify-between mt-2">
          {mode !== "login" ? (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setMode("login");
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Volver al login
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setMode("register");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Registrarse
            </button>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setMode("reset");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Olvidé mi contraseña
            </button>
          )}
        </div>

        {info && (
          <p className="text-xs text-green-600 text-center mt-3">{info}</p>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
