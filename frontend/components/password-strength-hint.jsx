"use client"

import { useState, useEffect } from "react"

export default function PasswordStrengthHint({ password }) {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  const getPasswordStrength = (pwd) => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/\d/.test(pwd)) strength++
    if (/[^a-zA-Z\d]/.test(pwd)) strength++
    return strength
  }

  const strength = getPasswordStrength(password)
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"]
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-green-600"]

  if (!password) return null

  return (
    <div className="mt-3">
      <div className="flex gap-1 mb-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < strength ? strengthColors[strength - 1] : darkMode ? "bg-gray-600" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
        Password Strength: <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{strengthLabels[strength]}</span>
      </p>
      <ul className={`text-xs mt-2 space-y-1 ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
        <li className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-green-600 dark:text-green-400" : ""}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? "bg-green-600 dark:bg-green-400" : darkMode ? "bg-gray-600" : "bg-slate-300"}`} />
          At least 8 characters
        </li>
        <li
          className={`flex items-center gap-1.5 ${/[a-z]/.test(password) && /[A-Z]/.test(password) ? "text-green-600 dark:text-green-400" : ""}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${/[a-z]/.test(password) && /[A-Z]/.test(password) ? "bg-green-600 dark:bg-green-400" : darkMode ? "bg-gray-600" : "bg-slate-300"}`}
          />
          Mix of uppercase & lowercase
        </li>
        <li className={`flex items-center gap-1.5 ${/\d/.test(password) ? "text-green-600 dark:text-green-400" : ""}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${/\d/.test(password) ? "bg-green-600 dark:bg-green-400" : darkMode ? "bg-gray-600" : "bg-slate-300"}`} />
          Contains a number
        </li>
        <li className={`flex items-center gap-1.5 ${/[^a-zA-Z\d]/.test(password) ? "text-green-600 dark:text-green-400" : ""}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${/[^a-zA-Z\d]/.test(password) ? "bg-green-600 dark:bg-green-400" : darkMode ? "bg-gray-600" : "bg-slate-300"}`}
          />
          Contains a special character
        </li>
      </ul>
    </div>
  )
}
