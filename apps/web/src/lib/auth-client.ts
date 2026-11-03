"use client"

import { useQuery } from "@tanstack/react-query"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface UserSession {
  user: {
    id: string
    email: string
    name: string
    avatar?: string | null
    avatarUrl?: string | null
  }
  session: {
    id: string
    userId: string
    expiresAt: string
    createdAt: string
  }
}

export type AuthError = { message?: string; code?: string } | null

export const authClient = {
  useSession: () => {
    const { data, isPending, error, refetch } = useQuery({
      queryKey: ["auth_session"],
      queryFn: async (): Promise<UserSession | null> => {
        try {
          const res = await fetch(`${API_URL}/v1/auth/me`, {
            credentials: "include",
          })
          if (res.ok) {
            const user = await res.json()
            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatarUrl,
                avatarUrl: user.avatarUrl,
              },
              session: user.session,
            }
          }
          return null
        } catch {
          return null
        }
      },
      staleTime: 60 * 1000,
      retry: false,
    })

    return {
      data: data ?? null,
      isPending,
      error: error ?? null,
      refetch,
    }
  },

  signIn: {
    social: async ({
      provider,
      callbackURL,
      errorCallbackURL,
    }: {
      provider: "github" | "google" | string
      callbackURL?: string
      errorCallbackURL?: string
    }): Promise<any> => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/sign-in/social`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ provider, callbackURL, errorCallbackURL }),
        })
        const text = await res.text()
        let data: any = {}
        try {
          data = JSON.parse(text)
        } catch {}

        if (!res.ok) {
          return {
            data: null,
            error: {
              message:
                data?.error?.message ||
                `Authentication failed: ${provider} OAuth is not configured yet or server returned status ${res.status}.`,
            },
          }
        }

        if (typeof window !== "undefined" && data?.url) {
          window.location.href = data.url
        }
        return { data, error: null }
      } catch (err: any) {
        return { data: null, error: { message: err?.message || "Sign-in failed" } }
      }
    },

    email: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        if (!res.ok) {
          return {
            data: null,
            error: {
              message: data.error?.message || "Invalid credentials",
            },
          }
        }
        return { data, error: null }
      } catch (err: any) {
        return {
          data: null,
          error: {
            message: err?.message || "Invalid credentials",
          },
        }
      }
    },
  },

  signUp: {
    email: async ({
      email,
      password,
      name,
    }: {
      email: string
      password: string
      name: string
    }) => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, name }),
        })
        const data = await res.json()
        if (!res.ok) {
          return {
            data: null,
            error: {
              message: data.error?.message || "Registration failed",
            },
          }
        }
        return { data, error: null }
      } catch (err: any) {
        return {
          data: null,
          error: {
            message: err?.message || "Registration failed",
          },
        }
      }
    },
  },

  signOut: async (): Promise<{ error: AuthError }> => {
    try {
      const response = await fetch(`${API_URL}/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) return { error: { message: "Could not sign out. Try again." } }
      window.location.href = "/login"
      return { error: null }
    } catch (err: any) {
      return { error: { message: err?.message || "Sign-out failed" } }
    }
  },

  // Accounts with a password must send it; the API answers 401 otherwise.
  deleteUser: async (opts?: { currentPassword?: string }): Promise<{ error: AuthError }> => {
    try {
      const response = await fetch(`${API_URL}/v1/users/me`, {
        method: "DELETE",
        credentials: "include",
        ...(opts?.currentPassword ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: opts.currentPassword }) } : {}),
      })
      if (!response.ok) {
        const body = await response.json()
        return { error: { message: body.error?.message || "Failed to delete account", code: body.error?.code } }
      }
      return { error: null }
    } catch (err: any) {
      return { error: { message: err?.message || "Failed to delete account" } }
    }
  },
}
