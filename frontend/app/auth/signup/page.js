"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth"
import { auth } from "../../../lib/firebase"
import { signup } from "../../../lib/api"
import { toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import BrandLogo from "../../../components/BrandLogo"

export default function Home() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const password = watch("password")

  const calculatePasswordStrength = (pwd) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      numbers: /[0-9]/.test(pwd),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
    }

    const score = Object.values(checks).filter(Boolean).length
    const feedback = []

    if (checks.length) feedback.push("length")
    if (checks.uppercase) feedback.push("uppercase")
    if (checks.lowercase) feedback.push("lowercase")
    if (checks.numbers) feedback.push("numbers")

    setPasswordStrength({ score, feedback })
  }

  const handlePasswordChange = (e) => {
    calculatePasswordStrength(e.target.value)
  }

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      // Step 1: Create user in Firebase using Client SDK
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      )

      // Step 2: Update display name in Firebase
      await updateProfile(userCredential.user, {
        displayName: data.name
      })

      // Step 3: Send email verification
      await sendEmailVerification(userCredential.user, {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false,
      })

      // Step 4: Call backend to register user (backend will NOT save to MongoDB yet)
      const result = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
      })

      if (result.success) {
        // Sign out the user since they need to verify email first
        await auth.signOut()
        
        toast.success(
          "Verification email sent! Please check your email and click the verification link to activate your account. You will be redirected to login page.",
          { autoClose: 5000 }
        )
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
      } else {
        // If backend fails, delete the Firebase user
        try {
          await userCredential.user.delete()
        } catch (deleteError) {
          console.error("Error deleting user:", deleteError)
        }
        toast.error(result.error || "Failed to create account. Please try again.")
      }
    } catch (error) {
      // Log full error to console for debugging (not shown to user)
      console.error("Signup error:", error)
      
      // Show generic or appropriate error messages (security best practice)
      let errorMessage = "Failed to create account. Please try again."
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email is already registered. Please login instead."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format. Please check your email address."
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger password with at least 8 characters."
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again."
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage = "Account creation is currently disabled. Please contact support."
      }
      // For all other errors, show generic message
      
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const getStrengthColor = () => {
    if (passwordStrength.score <= 2) return "bg-red-400"
    if (passwordStrength.score <= 3) return "bg-amber-400"
    return "bg-fuchsia-500"
  }

  const getStrengthText = () => {
    if (passwordStrength.score <= 2) return "Weak"
    if (passwordStrength.score <= 3) return "Fair"
    return "Strong"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <style>{`
        body {
          background: linear-gradient(135deg, #ffffff 0%, #fdf4ff 30%, #faf5ff 55%, #f5f3ff 80%, #fce7f3 100%);
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
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
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
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 245, 255, 0.95) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(192, 38, 211, 0.2);
        }

        .input-focus {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-focus:focus {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -8px rgba(124, 58, 237, 0.2);
          border-color: rgba(192, 38, 211, 0.45);
          background: rgba(253, 244, 255, 0.95);
        }

        .input-field {
          background: linear-gradient(135deg, rgba(253, 244, 255, 0.85) 0%, rgba(245, 243, 255, 0.75) 100%);
          border: 1.5px solid rgba(216, 180, 254, 0.55);
          color: #1e293b;
        }

        .input-field::placeholder {
          color: rgba(71, 85, 105, 0.5);
        }

        .btn-primary {
          background: linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #db2777 100%);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.35);
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
          box-shadow: 0 20px 40px -8px rgba(192, 38, 211, 0.4);
          background: linear-gradient(135deg, #6d28d9 0%, #a21caf 50%, #be185d 100%);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

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

        .badge-success {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(192, 38, 211, 0.08) 100%);
          border: 1px solid rgba(192, 38, 211, 0.35);
          color: #86198f;
        }

        .strength-bar {
          background: linear-gradient(90deg, rgba(233, 213, 255, 0.5) 0%, rgba(250, 232, 255, 0.5) 100%);
          border-radius: 10px;
          overflow: hidden;
          height: 6px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .error-field {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.3) !important;
        }

        .link-accent {
          color: #c026d3;
          transition: all 0.3s ease;
        }

        .link-accent:hover {
          color: #7c3aed;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .card-gradient {
            border-radius: 20px;
          }
        }
      `}</style>

      <div className="absolute top-0 left-0 w-96 h-96 bg-linear-to-br from-fuchsia-200 to-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float" />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 bg-linear-to-bl from-violet-200 to-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float"
        style={{ animationDelay: "2s" }}
      />

      <div className="w-full max-w-md animate-slide-in relative z-10">
        <div className="card-gradient rounded-3xl shadow-2xl p-8 md:p-10 border border-fuchsia-100/80">
          <div className="flex justify-center mb-6 logo-container">
            <BrandLogo className="h-32 w-auto max-w-[260px]" />
          </div>

          <div className="text-center mb-8">
            <p className="text-slate-600 text-sm font-medium">Join the future of intelligent hiring</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                {...register("name", { required: "Name is required" })}
                className={`w-full px-4 py-3 rounded-xl input-focus input-field outline-none ${
                  errors.name ? "error-field" : ""
                }`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-2 font-medium">{errors.name.message}</p>}
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
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
                  errors.email ? "error-field" : ""
                }`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-2 font-medium">{errors.email.message}</p>}
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                  })}
                  onChange={(e) => {
                    handlePasswordChange(e)
                    register("password").onChange(e)
                  }}
                  className={`w-full px-4 py-3 pr-12 rounded-xl input-focus input-field outline-none ${
                    errors.password ? "error-field" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-fuchsia-600 transition-colors duration-200"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
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

            {password && (
              <div className="animate-fade-in space-y-2 p-4 bg-linear-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-fuchsia-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Password Strength</span>
                  <span
                    className={`text-xs font-bold ${
                      passwordStrength.score <= 2
                        ? "text-red-600"
                        : passwordStrength.score <= 3
                          ? "text-amber-600"
                          : "text-fuchsia-600"
                    }`}
                  >
                    {getStrengthText()}
                  </span>
                </div>
                <div className="strength-bar">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { key: "length", label: "8+ characters" },
                    { key: "uppercase", label: "Uppercase" },
                    { key: "lowercase", label: "Lowercase" },
                    { key: "numbers", label: "Numbers" },
                  ].map((check) => (
                    <div key={check.key} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          passwordStrength.feedback.includes(check.key)
                            ? "bg-fuchsia-200 text-fuchsia-700"
                            : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        {passwordStrength.feedback.includes(check.key) ? "✓" : ""}
                      </div>
                      <span className="text-xs text-slate-600">{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                  })}
                  className={`w-full px-4 py-3 pr-12 rounded-xl input-focus input-field outline-none ${
                    errors.confirmPassword ? "error-field" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-fuchsia-600 transition-colors duration-200"
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
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
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-2 font-medium">{errors.confirmPassword.message}</p>
              )}
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
                  <span>Creating account...</span>
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-fuchsia-100/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-white text-slate-500 font-medium">or</span>
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <a href="/auth/login" className="link-accent font-semibold">
                Sign in
              </a>
            </p>
            <p className="text-xs text-slate-500">
              By signing up, you agree to our{" "}
              <a href="#" className="link-accent underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="link-accent underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 px-4 py-3 badge-success rounded-full mx-auto w-fit text-sm font-medium">
          <svg className="w-4 h-4 text-fuchsia-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Secure & Encrypted
        </div>
      </div>

    </div>
  )
}
