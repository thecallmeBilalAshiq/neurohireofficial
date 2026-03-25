"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import BrandLogo from "../../../components/BrandLogo";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { toast } from "react-toastify";
import { getActiveJobsForCandidates, getMyApplications } from "../../../lib/api";

function CandidateDashboardContent() {
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
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [applicationsCount, setApplicationsCount] = useState(0);
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
        const updated = [newError, ...prev].slice(0, 50);
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
        localStorage.removeItem("user");
        router.push("/auth/login");
      } else {
        const userData = localStorage.getItem("user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        fetchDashboardStats(token);
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

  const fetchDashboardStats = async (token) => {
    try {
      setLoadingStats(true);
      // Fetch active jobs count
      const jobsResult = await getActiveJobsForCandidates(token);
      if (jobsResult.success) {
        setActiveJobsCount(jobsResult.data?.length || 0);
      }

      // Fetch applications count
      const applicationsResult = await getMyApplications(token);
      if (applicationsResult.success) {
        setApplicationsCount(applicationsResult.data?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

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
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-white via-fuchsia-50/30 to-violet-50/40'}`}>
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
              <div className="flex items-center gap-2 flex-1 min-w-0 py-1">
                <BrandLogo className={`h-16 w-auto max-h-[4.25rem] shrink-0 ${darkMode ? 'brightness-110' : ''}`} />
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex justify-center w-full py-1">
                <BrandLogo className={`h-12 w-auto max-h-14 shrink-0 ${darkMode ? 'brightness-110' : ''}`} />
              </div>
            )}
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
                    router.push("/candidate/dashboard");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Overview</span>
                </button>

                <button
                  onClick={() => {
                    router.push("/candidate/apply");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Apply to Job</span>
                </button>
              </>
            )}
            
            {sidebarCollapsed && showMenuItems && (
              <div className="space-y-2 mt-4">
                <button
                  onClick={() => router.push("/candidate/dashboard")}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2 flex items-center justify-center cursor-pointer`}
                  title="Overview"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push("/candidate/apply")}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="Apply to Job"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>Welcome to NeuroHire Candidate Portal</p>
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
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {user?.name ? user.name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : 'C'}
                    </span>
                  </div>
                  <span className={`hidden sm:inline text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    {user?.name || user?.email || "User"}
                  </span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
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
          {/* Welcome Section */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 sm:p-8 border ${darkMode ? 'border-gray-700' : 'border-gray-100'} mb-6`}>
            <h2 className={`text-2xl sm:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
              Welcome, {user?.name || user?.email?.split('@')[0] || 'Candidate'}!
            </h2>
            <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
              Start your job search journey with NeuroHire. Browse available positions and apply to jobs that match your skills.
            </p>
            <button
              onClick={() => router.push("/candidate/apply")}
              className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Browse Jobs
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                    {applicationsCount}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Applications</div>
                </>
              )}
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-fuchsia-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-fuchsia-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>0</div>
              <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Interviews</div>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                    {activeJobsCount}
                  </div>
                  <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Jobs</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CandidateDashboard() {
  return (
    <ProtectedRoute requiredRole="candidate">
      <CandidateDashboardContent />
    </ProtectedRoute>
  );
}

