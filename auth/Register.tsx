import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithEmail } from "../services/firebase";

const [name, setName] = useState("");


export default function Register() {
  const navigate = useNavigate?.() as any;
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    try {
      await registerWithEmail(email, pass, name);
      if (navigate) navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          Crear cuenta
        </h2>

        <input
          type="text"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
          placeholder="Nombre completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />


        <input
          type="email"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-4 px-3 py-2 border rounded-lg text-sm"
          placeholder="Contraseña (mínimo 6)"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <button
          onClick={handleRegister}
          className="w-full mb-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Registrarme
        </button>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        <p className="text-xs text-center text-gray-500 mt-4">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="text-blue-600">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  );
}
