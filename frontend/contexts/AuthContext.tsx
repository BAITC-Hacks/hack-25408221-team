"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { isTokenValid, decodeToken } from "@/lib/auth"

interface AuthUser {
  userId: string
  name: string
  email?: string
  role?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (userId: string, name: string, token: string, email?: string, role?: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = "accessToken"
const USER_KEY = "user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = () => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)
      
      if (storedToken && storedUser) {
        if (isTokenValid(storedToken)) {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
          setToken(storedToken)
        } else {
          clearAuthData()
        }
      } else {
        clearAuthData()
      }
    } catch {
      clearAuthData()
    }
    setIsLoading(false)
  }

  const clearAuthData = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userPhone")
    localStorage.removeItem("program")
    localStorage.removeItem("videoSubmitted")
    clearCookies()
  }

  const clearCookies = () => {
    document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "accessToken=; path=/; max-age=0"
    document.cookie = "accessToken=; path=/; domain=localhost; max-age=0"
    const domain = typeof window !== "undefined" ? window.location.hostname : ""
    if (domain) {
      document.cookie = `accessToken=; path=/; domain=${domain}; max-age=0`
    }
  }

  const login = (userId: string, name: string, newToken: string, email?: string, role?: string) => {
    if (!isTokenValid(newToken)) {
      console.error("Cannot login with invalid/expired token")
      return
    }

    const userData: AuthUser = { userId, name, email, role }
    
    setUser(userData)
    setToken(newToken)
    
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    localStorage.setItem("userId", userId)
    localStorage.setItem("userName", name)
    if (email) localStorage.setItem("userEmail", email)
    document.cookie = `accessToken=${newToken}; path=/; max-age=86400; SameSite=Lax`
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    clearAuthData()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
