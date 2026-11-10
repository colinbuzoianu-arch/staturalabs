import type { en } from "./en";

export const ro: typeof en = {
  heading: "Autentificare cu doi factori",
  enrollIntro:
    "Rolul dvs. necesită un al doilea factor. Scanați codul QR cu o aplicație de autentificare (de ex. Google Authenticator, 1Password), apoi introduceți codul din 6 cifre pentru a finaliza.",
  challengeIntro:
    "Introduceți codul din 6 cifre din aplicația de autentificare pentru a continua.",
  secretLabel: "Sau introduceți manual această cheie de configurare:",
  codeLabel: "Cod din 6 cifre",
  verifyButton: "Verificare",
  verifying: "Se verifică…",
  loading: "Se încarcă…",
  success: "Autentificarea cu doi factori este activă. Redirecționare…",
  errorGeneric: "Codul nu a putut fi verificat. Încercați din nou.",
  errorEnroll:
    "Configurarea nu a putut fi inițiată. Reîncărcați pagina și încercați din nou.",
  signOut: "Deconectare",
};
