"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { verifyToken } from "../lib/api";
import { toast } from "react-toastify";

export default function ProtectedRoute({ children, requiredRole = null }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let unsubscribe;
    let isMounted = true;
    let tokenCheckInterval;

    const verifyUserToken = async (firebaseUser) => {
      if (!isMounted) return;

      try {
        // Get token result to check expiration time
        const tokenResult = await firebaseUser.getIdTokenResult();
        const expirationTime = tokenResult.expirationTime;
        const now = new Date();
        
        // Check if token is expired or will expire in the next minute
        if (new Date(expirationTime) <= new Date(now.getTime() + 60000)) {
          // Token expired or expiring soon, get fresh token
          await firebaseUser.getIdToken(true);
        }
        
        // Get fresh token (Firebase automatically refreshes if needed)
        const idToken = await firebaseUser.getIdToken();
        
        // Verify token with backend and get user role
        const result = await verifyToken(idToken);

        if (!result.success) {
          // Token invalid or expired
          if (result.error?.includes("expired") || result.error?.includes("revoked")) {
            toast.error("Your session has expired. Please login again.", {
              autoClose: 3000,
            });
          } else {
            toast.error("Authentication failed. Please login again.", {
              autoClose: 3000,
            });
          }
          
          // Sign out from Firebase
          await signOut(auth);
          localStorage.removeItem("user");
          setIsLoading(false);
          setIsAuthorized(false);
          router.push("/auth/login");
          return false;
        }

        const userData = result.data;

        // Check if role is required and matches
        if (requiredRole && userData.role !== requiredRole) {
          toast.error("You don't have permission to access this page.", {
            autoClose: 3000,
          });
          setIsLoading(false);
          setIsAuthorized(false);
          router.push("/");
          return false;
        }

        // Update localStorage with fresh user data
        localStorage.setItem("user", JSON.stringify({
          uid: userData.uid,
          email: userData.email,
          role: userData.role,
          name: userData.name,
        }));

        setIsAuthorized(true);
        setIsLoading(false);
        return true;
      } catch (error) {
        console.error("Token verification error:", error);
        
        // Handle token errors
        if (error.code === "auth/id-token-expired" || 
            error.code === "auth/id-token-revoked") {
          toast.error("Your session has expired. Please login again.", {
            autoClose: 3000,
          });
        } else {
          toast.error("Authentication failed. Please login again.", {
            autoClose: 3000,
          });
        }
        
        await signOut(auth);
        localStorage.removeItem("user");
        setIsLoading(false);
        setIsAuthorized(false);
        router.push("/auth/login");
        return false;
      }
    };

    const checkAuth = async () => {
      try {
        // Listen to Firebase auth state changes
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted) return;

          if (!firebaseUser) {
            // No user logged in
            setIsLoading(false);
            setIsAuthorized(false);
            localStorage.removeItem("user");
            router.push("/auth/login");
            return;
          }

          // Initial verification
          await verifyUserToken(firebaseUser);

          // Set up periodic token verification
          // Firebase ID tokens expire after 1 hour (3600 seconds)
          // We check every 5 minutes to catch expiration early
          if (tokenCheckInterval) {
            clearInterval(tokenCheckInterval);
          }
          
          tokenCheckInterval = setInterval(async () => {
            const currentUser = auth.currentUser;
            if (currentUser && isMounted) {
              const isValid = await verifyUserToken(currentUser);
              if (!isValid && tokenCheckInterval) {
                clearInterval(tokenCheckInterval);
              }
            }
          }, 5 * 60 * 1000); // Check every 5 minutes (token expires after 1 hour)
        });
      } catch (error) {
        console.error("Auth check error:", error);
        if (isMounted) {
          setIsLoading(false);
          setIsAuthorized(false);
          router.push("/auth/login");
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
    };
  }, [router, requiredRole]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authorized (redirect is happening)
  if (!isAuthorized) {
    return null;
  }

  // Render children if authorized
  return <>{children}</>;
}

