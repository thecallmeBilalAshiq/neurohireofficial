"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "react-toastify"
import PasswordField from "./password-field"
import PasswordStrengthHint from "./password-strength-hint"
import LoadingSpinner from "./loading-spinner"
import BrandLogo from "./BrandLogo"

export default function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const password = watch("password")

  const onSubmit = async (data) => {
    // Validate passwords match
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match", { position: "top-right" })
      return
    }

    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))
      console.log("Form data:", data)
      toast.success("Account created successfully!", { position: "top-right" })
      reset()
    } catch (error) {
      toast.error("Failed to create account. Please try again.", { position: "top-right" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="bg-white rounded-xl shadow-2xl p-8 border border-slate-200">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo className="h-28 w-auto max-w-[240px]" />
          </div>
          <p className="text-slate-500 text-sm mt-1">Create your account</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="John Doe"
              {...register("name", { required: "Name is required" })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Please enter a valid email",
                },
              })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Password Field */}
          <PasswordField
            label="Password"
            id="password"
            placeholder="Enter password"
            register={register}
            errors={errors}
            fieldName="password"
            required="Password is required"
          />

          {/* Confirm Password Field */}
          <PasswordField
            label="Confirm Password"
            id="confirmPassword"
            placeholder="Confirm password"
            register={register}
            errors={errors}
            fieldName="confirmPassword"
            required="Please confirm your password"
          />

          {/* Password Strength Hint */}
          <PasswordStrengthHint password={password} />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span>Creating Account...</span>
            </>
          ) : (
            "Sign Up"
          )}
        </button>

        {/* Login Link */}
        <p className="text-center text-slate-600 text-sm mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-fuchsia-600 font-semibold hover:text-violet-700 transition-colors">
            Log in
          </a>
        </p>
      </div>

      {/* Terms */}
      <p className="text-center text-slate-500 text-xs mt-4">
        By signing up, you agree to our{" "}
        <a href="#" className="underline hover:text-slate-700">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline hover:text-slate-700">
          Privacy Policy
        </a>
      </p>
    </form>
  )
}

