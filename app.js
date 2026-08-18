const supabaseUrl =
    "https://euyqvisqgxuwzcswwiqf.supabase.co";

const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eXF2aXNxZ3h1d3pjc3d3aXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NDY3OTIsImV4cCI6MjEwMjQyMjc5Mn0.9QjLUxFdiy-D92hImFtLuPcLQ81b47YK9PgyfwgjELc";

const client =
    window.supabase.createClient(
        supabaseUrl,
        supabaseKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        }
    );


// ==================================================
// AUTH / RBAC HELPERS
// ==================================================

async function getCurrentSession() {

    const {
        data,
        error
    } = await client.auth.getSession();

    if (error || !data.session) {
        return {
            session: null,
            user: null,
            error: error || new Error("No active session.")
        };
    }

    return {
        session: data.session,
        user: data.session.user,
        error: null
    };
}


async function getCurrentUserProfile() {

    const {
        session,
        user,
        error: sessionError
    } = await getCurrentSession();

    if (sessionError || !session || !user) {
        return {
            session: null,
            user: null,
            profile: null,
            error: sessionError || new Error("No active session.")
        };
    }

    const {
        data: profile,
        error
    } = await client
        .from("user_profiles")
        .select("id, full_name, role, active")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        return {
            session,
            user,
            profile: null,
            error: error || new Error("User profile not found.")
        };
    }

    if (profile.active !== true) {

        await client.auth.signOut();

        return {
            session: null,
            user: null,
            profile: null,
            error: new Error("Your MIS account is inactive.")
        };
    }

    return {
        session,
        user,
        profile,
        error: null
    };
}


async function requireLogin(
    redirectPage = "index.html"
) {

    const result =
        await getCurrentUserProfile();

    if (
        result.error ||
        !result.session ||
        !result.profile
    ) {
        window.location.href =
            redirectPage;

        return null;
    }

    return result;
}


async function requireAdmin(
    redirectPage = "home.html"
) {

    const result =
        await requireLogin();

    if (!result) {
        return null;
    }

    if (
        result.profile.role !== "Admin"
    ) {

        alert(
            "Access denied. Administrator permission is required."
        );

        window.location.href =
            redirectPage;

        return null;
    }

    return result;
}


// ==================================================
// LOGIN
// ==================================================

async function login() {

    const username =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value;

    const message =
        document
            .getElementById("message");

    const loginButton =
        document
            .getElementById("loginButton");


    message.innerHTML = "";


    if (!username || !password) {

        message.innerHTML =
            "Please enter User ID and Password.";

        return;

    }


    loginButton.disabled = true;

    loginButton.innerHTML =
        "LOGGING IN...";


    try {

        let email;

        if (username.includes("@")) {

            email =
                username
                    .toLowerCase();

        } else {

            email =
                username
                    .toLowerCase() +
                "@hexadox-mis.local";

        }


        const {
            data,
            error
        } =
            await client.auth.signInWithPassword({

                email: email,

                password: password

            });


        if (error) {

            message.innerHTML =
                error.message;

            return;

        }


        if (
            !data ||
            !data.session
        ) {

            message.innerHTML =
                "Login succeeded but no session was created.";

            return;

        }


        // Confirm the MIS profile is active.
        const profileResult =
            await getCurrentUserProfile();

        if (
            profileResult.error ||
            !profileResult.profile
        ) {

            await client.auth.signOut();

            message.innerHTML =
                profileResult.error?.message ||
                "MIS user profile could not be loaded.";

            return;
        }


        message.innerHTML =
            "Login successful.";


        setTimeout(
            () => {

                window.location.href =
                    "home.html";

            },
            300
        );

    }


    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        message.innerHTML =
            error.message ||
            "Login failed.";

    }


    finally {

        loginButton.disabled =
            false;

        loginButton.innerHTML =
            "LOGIN";

    }

}



// ==================================================
// LOGOUT
// ==================================================

async function logout() {

    try {

        await client.auth.signOut();

    }

    catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }


    window.location.href =
        "index.html";

}
