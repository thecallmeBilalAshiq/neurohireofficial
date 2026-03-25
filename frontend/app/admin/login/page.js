"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { adminLogin } from "../../../lib/api";
import LoadingSpinner from "../../../components/loading-spinner";
import PasswordField from "../../../components/password-field";
import BrandLogo from "../../../components/BrandLogo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode like the dashboard

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  // Save dark mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await adminLogin(data.email, data.password);

      if (result.success) {
        // Store admin token
        localStorage.setItem("adminToken", result.data.token);
        localStorage.setItem("admin", JSON.stringify(result.data.admin));

        toast.success("Admin login successful!", { position: "top-right" });
        router.push("/admin/hr");
      } else {
        toast.error(result.error || "Login failed", { position: "top-right" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gradient-to-b from-gray-900 via-violet-950/40 to-gray-900' : 'bg-gradient-to-br from-white via-fuchsia-50/50 to-violet-50'} py-12 px-4 sm:px-6 lg:px-8`}>
      <style>{`
        body {
          background: ${darkMode ? '#0f0a1a' : 'linear-gradient(135deg, #ffffff 0%, #fdf4ff 50%, #f5f3ff 100%)'};
          min-height: 100vh;
        }
      `}</style>

      <div className="w-full max-w-md">
        {/* Theme Toggle - Top Right */}
        <div className="flex justify-end mb-4">
          <div className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-1`}>
            <button
              onClick={() => setDarkMode(false)}
              className={`p-2 rounded transition-colors ${!darkMode ? 'bg-white shadow-sm' : darkMode ? 'hover:bg-gray-600' : ''}`}
              title="Light mode"
            >
              <svg className={`w-4 h-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={() => setDarkMode(true)}
              className={`p-2 rounded transition-colors ${darkMode ? 'bg-gray-600 shadow-sm' : ''}`}
              title="Dark mode"
            >
              <svg className={`w-4 h-4 ${darkMode ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl p-8 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {/* Logo */}
            <div className="mb-8 text-center">
              <div className="flex justify-center mb-4">
                <BrandLogo className={`h-28 w-auto max-w-[240px] ${darkMode ? 'brightness-110' : ''}`} />
              </div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Admin Login</h1>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>NeuroHire Administration Panel</p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Admin Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Please enter a valid email",
                    },
                  })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Password Field */}
              <PasswordField
                label="Admin Password"
                id="password"
                placeholder="Enter admin password"
                register={register}
                errors={errors}
                fieldName="password"
                required="Password is required"
                darkMode={darkMode}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-700 hover:via-fuchsia-700 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span>Logging in...</span>
                </>
              ) : (
                "Login as Admin"
              )}
            </button>

            {/* Back to main login link */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
              >
                ← Back to HR/Candidate Login
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
