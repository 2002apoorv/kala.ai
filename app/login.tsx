import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { auth } from '../firebase/firebase';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [pass, setPass] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return unsub;
  }, []);

  async function onLogin() {
    if (!email.trim() || !pass.trim()) {
      Alert.alert('Validation Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace('/');
    } catch (err: any) {
      let errorMessage = 'Login failed. Please try again.';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>🎨</Text>
          <Text style={styles.title}>Welcome to Kala.ai</Text>
          <Text style={styles.subtitle}>Sign in to your artisan account</Text>
        </View>

        <Card style={styles.formCard}>
          <TextInput 
            label="Email" 
            value={email} 
            onChangeText={setEmail} 
            mode="outlined"
            keyboardType="email-address" 
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            left={<TextInput.Icon icon="email" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
          
          <TextInput 
            label="Password" 
            secureTextEntry 
            value={pass} 
            onChangeText={setPass} 
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />

          <Button 
            mode="contained" 
            onPress={onLogin} 
            style={styles.loginButton}
            loading={loading}
            disabled={loading}
            buttonColor={colors.primary}
            icon="login"
          >
            Sign In
          </Button>
        </Card>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Button 
            mode="text" 
            onPress={() => router.push('/signup')}
            textColor={colors.primary}
            style={styles.signupLink}
          >
            Create Account
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  loginButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  signupLink: {
    marginLeft: -spacing.sm,
  },
});