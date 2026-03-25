"use client"

import { useState, useEffect } from "react"
import Eye from "./icons/eye"
import EyeOff from "./icons/eye-off"

export default function PasswordField({ label, id, placeholder, register, errors, fieldName, required }) {
  const [showPassword, setShowPassword] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          {...register(fieldName, { required })}
          className={`w-full px-4 py-2.5 pr-10 rounded-lg border focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all ${
            darkMode 
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
              : 'border-slate-300 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
            darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {errors[fieldName] && <p className="text-red-500 text-xs mt-1">{errors[fieldName].message}</p>}
    </div>
  )
}

