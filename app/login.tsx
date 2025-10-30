import { View, Button, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'expo-router';

// This is necessary for the auth session to work properly on web and mobile
WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Configure the Google authentication request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID, // Loaded from .env
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID, // Loaded from .env
  });

  useEffect(() => {
    // This effect handles the response from the Google authentication
    const handleResponse = async () => {
      if (response) {
        setLoading(true);
        if (response.type === 'success') {
          const { id_token } = response.params;
          const credential = GoogleAuthProvider.credential(id_token);
          try {
            await signInWithCredential(auth, credential);
            // On successful sign-in, the layout will redirect to /amazegame
          } catch (error) {
            console.error("Firebase sign-in error:", error);
            setLoading(false);
          }
        } else {
          // Handle unsuccessful login (e.g., user cancelled)
          setLoading(false);
        }
      }
    };

    handleResponse();
  }, [response]);

  // This effect listens for the user's auth state and redirects if they are already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect them away from the login page
        router.replace('/amazegame');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const handleGoogleSignIn = () => {
    if (request) {
      setLoading(true);
      promptAsync();
    } else {
      console.error("Google Auth Request is not ready.");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button
          title="Entrar com o Google"
          disabled={!request || loading}
          onPress={handleGoogleSignIn}
        />
      )}
    </View>
  );
}
