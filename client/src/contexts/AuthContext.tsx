const refreshUser = useCallback(async (): Promise<User | null> => {
  const token = getAuthToken();
  if (!token) {
    console.log("⚠️ [AuthContext-iOS] No token found - skipping refresh");
    return null;
  }

  try {
    console.log(
      "📡 [AuthContext-iOS] Starting refresh with token:",
      token.substring(0, 10) + "...",
    );
    const url = apiUrl(`/api/user/profile`);
    console.log("Refresh URL:", url);

    const headers = {
      ...getAuthHeaders(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    console.log("Request headers:", headers);

    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include", // Important for cookies/session if used
    });

    console.log("Refresh response status:", response.status);
    console.log("Refresh response ok:", response.ok);
    console.log("Refresh response headers:", [...response.headers.entries()]);

    if (response.ok) {
      const userData = await response.json();
      console.log("Refresh user data:", userData);
      // ... your updatedUser creation code ...
      setUser(updatedUser);
      localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
      console.log(
        "✅ [AuthContext-iOS] User refreshed successfully:",
        updatedUser.email,
      );
      return updatedUser;
    } else {
      const errorText = await response.text();
      console.error(
        "Refresh failed - status:",
        response.status,
        "body:",
        errorText,
      );
      return null;
    }
  } catch (error) {
    console.error("❌ [AuthContext-iOS] Refresh network error:", error);
    return null;
  }
}, []);
