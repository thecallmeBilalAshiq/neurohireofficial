"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { login } from "../../../lib/api";
import { toast } from "react-toastify";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Get ID token
      const idToken = await userCredential.user.getIdToken();

      // Verify with backend
      const result = await login(idToken);

      if (result.success) {
        // Check if email is verified
        if (!userCredential.user.emailVerified) {
          toast.error("Please verify your email before logging in. Check your inbox for the verification link and click it, then try logging in again.", {
            autoClose: 6000,
          });
          await auth.signOut(); // Sign out unverified user
          return;
        }

        toast.success(result.data.message || "Logged in successfully!");
        
        // Store user data in localStorage (optional)
        localStorage.setItem("user", JSON.stringify(result.data.user));
        
        // Redirect based on user role
        setTimeout(() => {
          if (result.data.user.role === 'HR') {
            router.push("/hr/dashboard");
          } else {
            router.push("/candidate/dashboard");
          }
        }, 1000);
      } else {
        // Check if error is about email verification
        if (result.error && result.error.includes("verify your email")) {
          toast.error(result.error, { autoClose: 6000 });
          await auth.signOut();
        } else {
          toast.error(result.error || "Login failed. Please try again.");
        }
      }
    } catch (error) {
      // Log full error to console for debugging (not shown to user)
      console.error("Login error:", error);
      
      // Show generic error message to user (security best practice)
      // Don't reveal whether email exists or password is wrong
      let errorMessage = "Invalid email or password. Please try again.";
      
      // Only show specific messages for non-security-sensitive errors
      if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format. Please check your email address.";
      }
      // For all other auth errors (user-not-found, wrong-password, invalid-credential, etc.)
      // Show generic message to prevent user enumeration attacks
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <style>{`
        body {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 25%, #cffafe 50%, #a7f3d0 75%, #d1fae5 100%);
          min-height: 100vh;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .animate-slide-in {
          animation: slideInUp 0.7s ease-out;
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .card-gradient {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 249, 255, 0.9) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(165, 243, 252, 0.5);
        }

        .input-focus {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-focus:focus {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -8px rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(240, 253, 250, 0.9);
        }

        .input-field {
          background: linear-gradient(135deg, rgba(240, 253, 250, 0.8) 0%, rgba(207, 250, 254, 0.6) 100%);
          border: 1.5px solid rgba(165, 243, 252, 0.6);
          color: #1e293b;
        }

        .input-field::placeholder {
          color: rgba(71, 85, 105, 0.5);
        }

        .btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25);
          position: relative;
          overflow: hidden;
        }

        .btn-primary::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.6s ease;
        }

        .btn-primary:hover:not(:disabled)::before {
          left: 100%;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px -8px rgba(16, 185, 129, 0.4);
          background: linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%);
        }

        .btn-primary:active:not(:disabled) { transform: translateY(0); }

        .btn-primary:disabled {
          background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
          box-shadow: 0 5px 15px -3px rgba(0, 0, 0, 0.1);
          cursor: not-allowed;
        }

        .logo-container {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .logo-container:hover {
          transform: scale(1.08) rotateY(5deg);
        }

        .link-accent {
          color: #10b981;
          transition: all 0.3s ease;
        }

        .link-accent:hover {
          color: #059669;
          text-decoration: underline;
        }

        .input-error {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
      `}</style>

      <div className="absolute top-0 left-0 w-96 h-96 bg-linear-to-br from-cyan-200 to-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />

      <div
        className="absolute bottom-0 right-0 w-96 h-96 bg-linear-to-bl from-blue-200 to-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"
        style={{ animationDelay: "2s" }}
      />

      <div className="w-full max-w-md animate-slide-in relative z-10">
        <div className="card-gradient rounded-3xl shadow-2xl p-8 md:p-10 border border-cyan-100">
          <div className="flex justify-center mb-8">
            <div className="logo-container w-20 h-20 bg-linear-to-br from-cyan-400 via-teal-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-3xl drop-shadow">NH</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-transparent-900 mb-2 bg-linear-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              NeuroHire
            </h1>
            <p className="text-slate-600 text-sm font-medium">Welcome back to intelligent hiring</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                placeholder="you@neurohire.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email address",
                  },
                })}
                className={`w-full px-4 py-3 rounded-xl input-focus input-field outline-none ${
                  errors.email ? "input-error" : ""
                }`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-2 font-medium">{errors.email.message}</p>}
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <a href="/auth/forgot-password" className="link-accent text-xs font-semibold">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                  className={`w-full px-4 py-3 pr-12 rounded-xl input-focus input-field outline-none ${
                    errors.password ? "input-error" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-600 transition-colors duration-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-2 font-medium">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 mt-8 text-lg"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cyan-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-white text-slate-500 font-medium">or</span>
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600">
              Don&#39;t have an account?{" "}
              <a href="/auth/signup" className="link-accent font-semibold">
                Sign up
              </a>
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              By signing in, you agree to our{" "}
              <a href="#" className="link-accent">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="link-accent">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}