"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "../../../lib/firebase"
import { toast } from "react-toastify"
import BrandLogo from "../../../components/BrandLogo"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      // Configure action code settings for password reset
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false, // Set to false to open link in browser
      }

      // Send password reset email via Firebase with proper settings
      await sendPasswordResetEmail(auth, data.email, actionCodeSettings)

      // Show success message (don't reveal if email exists for security)
      toast.success("If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.")
      reset()
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
    } catch (error) {
      // Log full error to console for debugging
      console.error("Forgot password error:", error)
      
      // Show generic message for security (don't reveal if email exists)
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-email") {
        // Don't reveal if email exists for security
        toast.success("If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.")
        reset()
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
        return
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please try again later.")
      } else {
        // Generic error message
        toast.error("Failed to send reset link. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
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

        .link-accent {
          color: #c026d3;
          transition: all 0.3s ease;
        }

        .link-accent:hover {
          color: #7c3aed;
          text-decoration: underline;
        }

        .input-error {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.3) !important;
        }

        @media (max-width: 640px) {
          .card-gradient {
            border-radius: 20px;
          }
        }
      `}</style>

      {/* Floating background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-linear-to-br from-fuchsia-200 to-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float" />

      <div
        className="absolute bottom-0 right-0 w-96 h-96 bg-linear-to-bl from-violet-200 to-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float"
        style={{ animationDelay: "2s" }}
      />

      <div className="w-full max-w-md animate-slide-in relative z-10">
        <div className="card-gradient rounded-3xl shadow-2xl p-8 md:p-10 border border-fuchsia-100/80">
          {/* Logo Section */}
          <div className="flex justify-center mb-6 logo-container">
            <BrandLogo className="h-32 w-auto max-w-[260px]" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-slate-600 text-sm font-medium">Reset your password</p>
          </div>

          {/* Description */}
          <div className="mb-6 p-4 bg-linear-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-fuchsia-100/80">
            <p className="text-slate-700 text-sm leading-relaxed">
              Enter your email address and we&#39;ll send you a link to reset your password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div className="animate-fade-in">
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

            {/* Submit Button */}
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
                  <span>Sending reset link...</span>
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-fuchsia-100/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-white text-slate-500 font-medium">or</span>
            </div>
          </div>

          {/* Footer Links */}
          <div className="text-center space-y-3">
            <p className="text-sm text-slate-600">
              Remember your password?{" "}
              <a href="/auth/login" className="link-accent font-semibold">
                Sign in
              </a>
            </p>
            <p className="text-sm text-slate-600">
              Don&#39;t have an account?{" "}
              <a href="/auth/signup" className="link-accent font-semibold">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

