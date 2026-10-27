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
                avatar: user.avatar_url,
                avatarUrl: user.avatar_url,
              },
              session: {
                id: user.id,
                userId: user.id,
                expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
                createdAt: new Date().toISOString(),
              },
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
      await fetch(`${API_URL}/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      window.location.href = "/login"
      return { error: null }
    } catch (err: any) {
      window.location.href = "/login"
      return { error: { message: err?.message || "Sign-out failed" } }
    }
  },

  listAccounts: async (): Promise<{ data: any[]; error: AuthError }> => ({
    data: [],
    error: null,
  }),

  linkSocial: async (_: any): Promise<{ error: AuthError }> => ({
    error: null,
  }),

  unlinkAccount: async (_: any): Promise<{ error: AuthError }> => ({
    error: null,
  }),

  deleteUser: async (_?: any): Promise<{ error: AuthError }> => {
    try {
      await fetch(`${API_URL}/v1/users/me`, {
        method: "DELETE",
        credentials: "include",
      })
      window.location.href = "/login"
      return { error: null }
    } catch (err: any) {
      window.location.href = "/login"
      return { error: { message: err?.message || "Failed to delete account" } }
    }
  },
}
