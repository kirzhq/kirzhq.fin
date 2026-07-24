const button = document.querySelector('#passkey-signin');
const status = document.querySelector('#passkey-status');
const errorMessage = document.querySelector('#error-message');
const csrfField = document.querySelector('#csrf-field');

function cookie(name) {
  return document.cookie.split('; ')
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=').slice(1).join('=');
}

function decode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0)).buffer;
}

function encode(value) {
  const bytes = String.fromCharCode(...new Uint8Array(value));
  return btoa(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signInWithPasskey() {
  button.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Ожидаю подтверждение Touch ID…';

  try {
    const csrf = decodeURIComponent(cookie('XSRF-TOKEN') || '');
    const optionsResponse = await fetch('/webauthn/authenticate/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf },
    });
    if (!optionsResponse.ok) throw new Error('Не удалось получить параметры входа');

    const options = await optionsResponse.json();
    const credential = await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge: decode(options.challenge),
        allowCredentials: (options.allowCredentials || []).map((item) => ({ ...item, id: decode(item.id) })),
      },
    });

    const response = credential.response;
    const verification = await fetch('/login/webauthn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf },
      body: JSON.stringify({
        id: credential.id,
        rawId: encode(credential.rawId),
        response: {
          authenticatorData: encode(response.authenticatorData),
          clientDataJSON: encode(response.clientDataJSON),
          signature: encode(response.signature),
          userHandle: response.userHandle ? encode(response.userHandle) : null,
        },
        type: credential.type,
        clientExtensionResults: credential.getClientExtensionResults(),
        authenticatorAttachment: credential.authenticatorAttachment,
      }),
    });
    const result = await verification.json();
    if (!verification.ok || !result.authenticated) throw new Error('Ключ не прошёл проверку');

    window.location.replace('/');
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.name === 'NotAllowedError'
      ? 'Вход отменён или ключ Touch ID не найден.'
      : 'Не удалось войти с Touch ID. Попробуйте ещё раз.';
    button.disabled = false;
  }
}

const csrf = cookie('XSRF-TOKEN');
if (csrfField && csrf) csrfField.value = decodeURIComponent(csrf);
if (new URLSearchParams(window.location.search).has('error')) errorMessage.hidden = false;

if (!window.PublicKeyCredential) {
  button.disabled = true;
  status.classList.add('error');
  status.textContent = 'Этот браузер не поддерживает вход по passkey.';
} else {
  button.addEventListener('click', signInWithPasskey);
}
