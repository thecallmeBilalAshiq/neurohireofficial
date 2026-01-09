"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { toast } from "react-toastify";
import { getDashboardStatistics } from "../../../lib/api";

function HRDashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMenuItems, setShowMenuItems] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [errors, setErrors] = useState([]);
  const [statistics, setStatistics] = useState({
    activeJobs: 0,
    completedJobs: 0,
    hiredCandidates: 0,
    totalCandidates: 0,
    monthlyData: {
      months: [],
      applications: [],
      candidates: []
    }
  });
  const [loadingStats, setLoadingStats] = useState(true);

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

  // Load errors from localStorage on mount
  useEffect(() => {
    const savedErrors = localStorage.getItem('systemErrors');
    if (savedErrors) {
      try {
        setErrors(JSON.parse(savedErrors));
      } catch (e) {
        console.error('Error parsing saved errors:', e);
      }
    }

    // Listen for errors from API interceptor
    const handleError = (event) => {
      const errorData = event.detail;
      const newError = {
        id: Date.now(),
        message: errorData.message || 'An error occurred',
        type: errorData.type || 'error',
        timestamp: new Date().toISOString(),
        source: errorData.source || 'System',
        status: errorData.status
      };
      setErrors(prev => {
        const updated = [newError, ...prev].slice(0, 50); // Keep last 50 errors
        localStorage.setItem('systemErrors', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('systemError', handleError);
    return () => window.removeEventListener('systemError', handleError);
  }, []);

  // Global error handler for unhandled errors
  useEffect(() => {
    const handleUnhandledError = (event) => {
      const newError = {
        id: Date.now(),
        message: event.error?.message || 'An unexpected error occurred',
        type: 'error',
        timestamp: new Date().toISOString(),
        source: 'System'
      };
      setErrors(prev => {
        const updated = [newError, ...prev].slice(0, 50);
        localStorage.setItem('systemErrors', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', (event) => {
      const newError = {
        id: Date.now(),
        message: event.reason?.message || 'Promise rejection',
        type: 'error',
        timestamp: new Date().toISOString(),
        source: 'System'
      };
      setErrors(prev => {
        const updated = [newError, ...prev].slice(0, 50);
        localStorage.setItem('systemErrors', JSON.stringify(updated));
        return updated;
      });
    });

    return () => {
      window.removeEventListener('error', handleUnhandledError);
    };
  }, []);

  const fetchStatistics = async (token) => {
    try {
      setLoadingStats(true);
      const result = await getDashboardStatistics(token);
      if (result.success) {
        setStatistics(result.data);
      } else {
        console.error('Failed to fetch statistics:', result.error);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }

    // Listen to auth state changes to handle token expiration
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // User signed out, redirect to login
        localStorage.removeItem("user");
        router.push("/auth/login");
      } else {
        // Update user data from localStorage
        const userData = localStorage.getItem("user");
        let parsedUser = null;
        if (userData) {
          parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
        // Get ID token for API calls
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        if (parsedUser?.role === 'HR') {
          fetchStatistics(token);
        }
      }
    });

    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.relative')) {
        setShowDropdown(false);
      }
      if (showNotificationDropdown && !event.target.closest('.relative')) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [router, showDropdown, showNotificationDropdown]);

  // Charts data based on real statistics
  const applicationsData = statistics.monthlyData?.months?.map((month, index) => ({
    month: month,
    applications: statistics.monthlyData.applications[index] || 0,
    candidates: statistics.monthlyData.candidates[index] || 0
  })) || [];

  // Sample data for charts (keeping for structure, but will use real data)
  const paymentsData = [
    { month: "Sep", received: 45, due: 60 },
    { month: "Oct", received: 52, due: 65 },
    { month: "Nov", received: 48, due: 70 },
    { month: "Dec", received: 55, due: 75 },
    { month: "Jan", received: 60, due: 80 },
    { month: "Feb", received: 58, due: 78 },
    { month: "Mar", received: 62, due: 80 },
    { month: "Apr", received: 65, due: 82 },
    { month: "May", received: 70, due: 85 },
    { month: "Jun", received: 68, due: 83 },
    { month: "Jul", received: 72, due: 88 },
    { month: "Aug", received: 75, due: 90 },
  ];

  const profitData = [
    { day: "M", value1: 120, value2: 80 },
    { day: "T", value1: 150, value2: 100 },
    { day: "W", value1: 180, value2: 120 },
    { day: "F", value1: 200, value2: 140 },
    { day: "S", value1: 160, value2: 110 },
    { day: "S", value1: 140, value2: 90 },
    { day: "F", value1: 220, value2: 160 },
  ];

  const stocks = [
    { name: "Apple Inc", shares: 16, logo: "🍎" },
    { name: "Google", shares: 100, logo: "🔍" },
    { name: "Tesla", shares: 20, logo: "⚡" },
    { name: "Twitter", shares: 57, logo: "🐦" },
    { name: "Microsoft", shares: 37, logo: "🪟" },
  ];


  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user");
      toast.success("Logged out successfully", { autoClose: 2000 });
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <style>{`
        body {
          background: ${darkMode ? '#111827' : '#f9fafb'};
          min-height: 100vh;
        }
      `}</style>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} relative`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-linear-to-br from-cyan-400 via-teal-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-lg">NH</span>
                </div>
                <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>NeuroHire</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-linear-to-br from-cyan-400 via-teal-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-lg">NH</span>
              </div>
            )}
            {/* Sidebar Toggle Button - Always visible */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`flex-shrink-0 p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors hidden lg:flex ${sidebarCollapsed ? 'absolute top-2 right-2' : ''}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className={`flex-1 p-4 overflow-y-auto ${sidebarCollapsed ? 'p-2' : ''}`}>
          {!sidebarCollapsed && (
            <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-4 px-3`}>MAIN MENU</div>
          )}
          
          <div className="space-y-1">
            <button
              onClick={() => {
                setShowMenuItems(!showMenuItems);
                setShowSidebar(false);
              }}
              className={`w-full ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'} rounded-lg ${sidebarCollapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2.5'} flex items-center gap-3 cursor-pointer`}
              title={sidebarCollapsed ? 'Dashboard' : ''}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {!sidebarCollapsed && (
                <>
                  <span className={`text-sm font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>Dashboard</span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'} ml-auto transition-transform ${showMenuItems ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              )}
            </button>

            {showMenuItems && !sidebarCollapsed && (
              <>
                <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mt-4 mb-2 px-3`}>OPTIONS</div>
                
                <button
                  onClick={() => {
                    router.push("/hr/dashboard");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Analytics</span>
                </button>

                <button
                  onClick={() => {
                    router.push("/hr/job-posting");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Create Job Posting</span>
                </button>

                <button
                  onClick={() => {
                    router.push("/hr/ranked-candidates");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>View Ranked Candidates</span>
                </button>
              </>
            )}
            
            {/* Collapsed menu items */}
            {sidebarCollapsed && showMenuItems && (
              <div className="space-y-2 mt-4">
                <button
                  onClick={() => router.push("/hr/dashboard")}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2 flex items-center justify-center cursor-pointer`}
                  title="Analytics"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push("/hr/job-posting")}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="Create Job Posting"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push("/hr/ranked-candidates")}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="View Ranked Candidates"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`lg:hidden p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
              >
                <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1 text-center lg:text-left">
                <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Dashboard</h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>NeuroHire where hiring meets AI</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme Toggle */}
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

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg relative transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {errors.length > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {errors.length > 9 ? '9+' : errors.length}
                    </span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className={`absolute right-0 mt-2 w-80 sm:w-96 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50 max-h-96 overflow-hidden flex flex-col`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        System Errors ({errors.length})
                      </h3>
                      {errors.length > 0 && (
                        <button
                          onClick={() => {
                            setErrors([]);
                            localStorage.removeItem('systemErrors');
                          }}
                          className={`text-xs ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {errors.length === 0 ? (
                        <div className={`px-4 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No errors</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {errors.map((error) => (
                            <div key={error.id} className={`px-4 py-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}`}>
                                      {error.type.toUpperCase()}
                                    </span>
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {new Date(error.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} break-words`}>
                                    {error.message}
                                  </p>
                                  {error.source && (
                                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                      Source: {error.source}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setErrors(prev => {
                                      const updated = prev.filter(e => e.id !== error.id);
                                      localStorage.setItem('systemErrors', JSON.stringify(updated));
                                      return updated;
                                    });
                                  }}
                                  className={`flex-shrink-0 p-1 ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                                  title="Dismiss"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile with Dropdown */}
              <div className="relative">
                <div 
                  className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg px-2 sm:px-3 py-2 transition-colors`}
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">HR</span>
                  </div>
                  <span className={`hidden sm:inline text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{user?.email || "Email"}</span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className={`w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors flex items-center gap-2`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className={`flex-1 p-4 sm:p-6 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            {/* Active Jobs */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              {loadingStats ? (
                <div className="animate-pulse">
                  <div className={`h-8 bg-gray-300 rounded mb-2 ${darkMode ? 'bg-gray-700' : ''}`}></div>
                </div>
              ) : (
                <>
                  <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                    {statistics.activeJobs}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Active Jobs</div>
                </>
              )}
            </div>

            {/* Completed Jobs */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              {loadingStats ? (
                <div className="animate-pulse">
                  <div className={`h-8 bg-gray-300 rounded mb-2 ${darkMode ? 'bg-gray-700' : ''}`}></div>
                </div>
              ) : (
                <>
                  <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                    {statistics.completedJobs}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Completed Jobs</div>
                </>
              )}
            </div>

            {/* Hired Candidates */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              {loadingStats ? (
                <div className="animate-pulse">
                  <div className={`h-8 bg-gray-300 rounded mb-2 ${darkMode ? 'bg-gray-700' : ''}`}></div>
                </div>
              ) : (
                <>
                  <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                    {statistics.hiredCandidates}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Hired Candidates</div>
                </>
              )}
            </div>

            {/* Total Candidates */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              {loadingStats ? (
                <div className="animate-pulse">
                  <div className={`h-8 bg-gray-300 rounded mb-2 ${darkMode ? 'bg-gray-700' : ''}`}></div>
                </div>
              ) : (
                <>
                  <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                    {statistics.totalCandidates}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Total Candidates</div>
                </>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {/* Applications Overview */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Applications Overview</h3>
              </div>
              {loadingStats ? (
                <div className="h-48 sm:h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <>
                  <div className="h-48 sm:h-64 overflow-x-auto">
                    <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
                      {/* Calculate max value for scaling */}
                      {(() => {
                        // Ensure values are numbers to prevent NaN
                        const safeData = applicationsData.map(d => ({
                          applications: Number(d.applications) || 0,
                          candidates: Number(d.candidates) || 0,
                          month: d.month
                        }));
                        const maxApps = applicationsData.length > 0 ? Math.max(...safeData.map(d => d.applications), 1) : 1;
                        const maxCandidates = applicationsData.length > 0 ? Math.max(...safeData.map(d => d.candidates), 1) : 1;
                        const maxValue = Math.max(maxApps, maxCandidates, 1);
                        
                        const yAxisValues = [0, Math.ceil(maxValue * 0.25), Math.ceil(maxValue * 0.5), Math.ceil(maxValue * 0.75), Math.ceil(maxValue)];
                        // Remove duplicates to avoid key conflicts
                        const uniqueYAxisValues = [...new Set(yAxisValues)];
                        
                        return (
                          <>
                            {/* Y-axis labels */}
                            {uniqueYAxisValues.map((val, idx) => (
                              <text key={`y-label-${idx}-${val}`} x="10" y={200 - (val / maxValue) * 180} className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`}>
                                {val}
                              </text>
                            ))}
                            
                            {/* Grid lines */}
                            {uniqueYAxisValues.map((val, idx) => (
                              <line
                                key={`grid-${idx}-${val}`}
                                x1="40"
                                y1={200 - (val / maxValue) * 180}
                                x2="580"
                                y2={200 - (val / maxValue) * 180}
                                stroke={darkMode ? "#374151" : "#e5e7eb"}
                                strokeWidth="1"
                              />
                            ))}

                            {/* Applications line */}
                            <polyline
                              points={safeData.map((d, i) => {
                                const x = safeData.length > 1 ? 40 + (i / (safeData.length - 1)) * 540 : 290;
                                const y = 200 - (d.applications / maxValue) * 180;
                                return `${x},${y}`;
                              }).join(" ")}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                            />

                            {/* Candidates line */}
                            <polyline
                              points={safeData.map((d, i) => {
                                const x = safeData.length > 1 ? 40 + (i / (safeData.length - 1)) * 540 : 290;
                                const y = 200 - (d.candidates / maxValue) * 180;
                                return `${x},${y}`;
                              }).join(" ")}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth="2"
                            />

                            {/* Data points */}
                            {safeData.map((d, i) => {
                              const x = safeData.length > 1 ? 40 + (i / (safeData.length - 1)) * 540 : 290;
                              return (
                                <g key={`data-point-${i}-${d.month}`}>
                                  <circle cx={x} cy={200 - (d.applications / maxValue) * 180} r="4" fill="#10b981" />
                                  <circle cx={x} cy={200 - (d.candidates / maxValue) * 180} r="4" fill="#06b6d4" />
                                </g>
                              );
                            })}

                            {/* X-axis labels */}
                            {safeData.map((d, i) => {
                              const x = safeData.length > 1 ? 40 + (i / (safeData.length - 1)) * 540 : 290;
                              return (
                                <text key={`x-label-${i}-${d.month}`} x={x} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                                  {d.month}
                                </text>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} gap-3 sm:gap-0`}>
                    <div>
                      <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Applications</div>
                      <div className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{statistics.totalApplications}</div>
                    </div>
                    <div>
                      <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Unique Candidates</div>
                      <div className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{statistics.totalCandidates}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Job Status Distribution */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Job Status Distribution</h3>
              </div>
              {loadingStats ? (
                <div className="h-48 sm:h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <div className="h-48 sm:h-64 overflow-x-auto">
                  <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                    {(() => {
                      // Ensure values are numbers to prevent NaN
                      const activeJobs = Number(statistics.activeJobs) || 0;
                      const completedJobs = Number(statistics.completedJobs) || 0;
                      const maxValue = Math.max(activeJobs, completedJobs, 1);
                      const barWidth = 80;
                      const spacing = 100;
                      const startX = 80;
                      
                      const yAxisValues = [0, Math.ceil(maxValue * 0.25), Math.ceil(maxValue * 0.5), Math.ceil(maxValue * 0.75), Math.ceil(maxValue)];
                      // Remove duplicates to avoid key conflicts
                      const uniqueYAxisValues = [...new Set(yAxisValues)];
                      
                      return (
                        <>
                          {/* Y-axis labels */}
                          {uniqueYAxisValues.map((val, idx) => (
                            <text key={`job-y-label-${idx}-${val}`} x="10" y={200 - (val / maxValue) * 180} className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`}>
                              {val}
                            </text>
                          ))}
                          
                          {/* Grid lines */}
                          {uniqueYAxisValues.map((val, idx) => (
                            <line
                              key={`job-grid-${idx}-${val}`}
                              x1="40"
                              y1={200 - (val / maxValue) * 180}
                              x2="380"
                              y2={200 - (val / maxValue) * 180}
                              stroke={darkMode ? "#374151" : "#e5e7eb"}
                              strokeWidth="1"
                            />
                          ))}

                          {/* Active Jobs Bar */}
                          <g>
                            <rect
                              x={startX}
                              y={200 - (activeJobs / maxValue) * 180}
                              width={barWidth}
                              height={(activeJobs / maxValue) * 180}
                              fill="#10b981"
                            />
                            <text x={startX + barWidth / 2} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                              Active
                            </text>
                            <text x={startX + barWidth / 2} y={195 - (activeJobs / maxValue) * 180} className={`text-xs font-semibold ${darkMode ? 'fill-white' : 'fill-gray-800'}`} textAnchor="middle">
                              {activeJobs}
                            </text>
                          </g>

                          {/* Completed Jobs Bar */}
                          <g>
                            <rect
                              x={startX + spacing}
                              y={200 - (completedJobs / maxValue) * 180}
                              width={barWidth}
                              height={(completedJobs / maxValue) * 180}
                              fill="#f59e0b"
                            />
                            <text x={startX + spacing + barWidth / 2} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                              Completed
                            </text>
                            <text x={startX + spacing + barWidth / 2} y={195 - (completedJobs / maxValue) * 180} className={`text-xs font-semibold ${darkMode ? 'fill-white' : 'fill-gray-800'}`} textAnchor="middle">
                              {completedJobs}
                            </text>
                          </g>
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

export default function HRDashboard() {
  return (
    <ProtectedRoute requiredRole="HR">
      <HRDashboardContent />
    </ProtectedRoute>
  );
}

