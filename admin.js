
const config = window.PIECERL_CONFIG;

const client = window.supabase.createClient(
  config.supabaseUrl,
  config.supabaseAnonKey
);

const $ = id => document.getElementById(id);

async function refresh() {
  const { data: { session }, error } =
    await client.auth.getSession();

  if (error) {
    $("loginMessage").textContent = error.message;
    return;
  }

  $("login").style.display = session ? "none" : "block";
  $("dashboard").style.display = session ? "block" : "none";

  if (session) await loadGames();
}

$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Signing in...";

  const { error } = await client.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    $("loginMessage").textContent = error.message;
  } else {
    $("loginMessage").textContent = "Welcome!";
    await refresh();
  }
};

$("logoutBtn").onclick = async () => {
  await client.auth.signOut();
  await refresh();
};

async function loadGames() {
  $("gamesList").textContent = "Loading games...";

  const { data, error } = await client
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("gamesList").textContent = "Error: " + error.message;
    return;
  }

  $("gamesList").innerHTML = "";

  if (!data.length) {
    $("gamesList").textContent = "No games published yet.";
    return;
  }

  data.forEach(game => {
    const item = document.createElement("div");
    item.className = "game";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.name;

    const description = document.createElement("p");
    description.textContent = game.description;

    const link = document.createElement("a");
    link.href = game.game_url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open game";

    info.append(title, description, link);

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "DELETE";
    del.onclick = () => deleteGame(game);

    item.append(info, del);
    $("gamesList").append(item);
  });
}

async function deleteGame(game) {
  if (!confirm("Delete " + game.name + "?")) return;

  if (game.storage_path !== "external") {
    const { error } = await client.storage
      .from("games")
      .remove([game.storage_path]);

    if (error) {
      alert("File deletion failed: " + error.message);
      return;
    }
  }

  const { error } = await client
    .from("games")
    .delete()
    .eq("id", game.id);

  if (error) {
    alert(error.message);
  } else {
    await loadGames();
  }
}

$("publishBtn").onclick = async () => {
  const name = $("gameName").value.trim();
  const description = $("description").value.trim();
  const category = $("category").value.trim() || "Other";
  const file = $("gameFile").files[0];
  const externalUrl = $("gameUrl").value.trim();

  if (!name || !description) {
    $("message").textContent =
      "Enter a game name and description.";
    return;
  }

  if (Boolean(file) === Boolean(externalUrl)) {
    $("message").textContent =
      "Choose an HTML file OR enter a game URL.";
    return;
  }

  if (externalUrl &&
      !/^https?:\/\//i.test(externalUrl)) {
    $("message").textContent =
      "Enter a valid website URL beginning with https://";
    return;
  }

  $("publishBtn").disabled = true;
  $("message").textContent = "Publishing game...";

  let storagePath = "external";
  let gameUrl = externalUrl;

  try {
    if (file) {
      if (!/\.(html|htm)$/i.test(file.name)) {
        throw new Error("Please select an HTML file.");
      }

      storagePath =
        crypto.randomUUID() + "-" + file.name;

      const { error: uploadError } = await client.storage
        .from("games")
        .upload(storagePath, file, {
          contentType: "text/html",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = client.storage
        .from("games")
        .getPublicUrl(storagePath);

      gameUrl = data.publicUrl;
    }

    const { error } = await client
      .from("games")
      .insert({
        name,
        description,
        category,
        game_url: gameUrl,
        storage_path: storagePath
      });

    if (error) {
      if (file) {
        await client.storage.from("games")
          .remove([storagePath]);
      }
      throw error;
    }

    $("message").textContent =
      "Game published successfully!";

    $("gameName").value = "";
    $("description").value = "";
    $("category").value = "";
    $("gameFile").value = "";
    $("gameUrl").value = "";

    await loadGames();

  } catch (error) {
    $("message").textContent =
      "Publishing error: " + error.message;
  } finally {
    $("publishBtn").disabled = false;
  }
};

client.auth.onAuthStateChange(() => {
  setTimeout(refresh, 0);
});

refresh();

