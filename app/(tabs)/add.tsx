// --- app/(tabs)/add.tsx --- (Add Product)
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { API_BASE_URL } from '../../constants/api';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import { auth, db } from '../../firebase/firebase';

export default function AddProduct() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [croppedImageBase64, setCroppedImageBase64] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const router = useRouter();

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, base64: true });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImageUri(asset.uri!);

      let dataUrl: string | null = null;
      if (asset.base64) {
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      } else {
        const fileBase64 = await FileSystem.readAsStringAsync(asset.uri!, { encoding: 'base64' });
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${fileBase64}`;
      }
      setCroppedImageBase64(dataUrl);
    }
  }

  async function cropImage() {
    if (!croppedImageBase64) return Alert.alert('Please pick and crop an image first');
    
    try {
      setIsEnhancing(true);
      const resp = await fetch(`${API_BASE_URL}/api/enhance-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64 }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Crop Image Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      if (json.ok && json.enhancedImageUrl) {
        setImageUri(json.enhancedImageUrl);
        setCroppedImageBase64(json.enhancedImageUrl);
        Alert.alert('Success', 'Image cropped and enhanced successfully.');
      } else {
        Alert.alert('Crop Image Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Crop error:', err);
      Alert.alert('Crop Image Failed', err.message || 'Unable to crop image');
    } finally {
      setIsEnhancing(false);
    }
  }

  async function generateProductInfo() {
    if (!croppedImageBase64) return Alert.alert('Please crop the image first');
    
    try {
      setIsGenerating(true);
      const resp = await fetch(`${API_BASE_URL}/api/generate-product-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64, language: 'hi-IN' }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Generate Text Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      
      if (json.ok) {
        setTitle(json.title || '');
        setDesc(json.description || '');
        if (json.estimatedPrice && json.estimatedPrice !== '0') {
          setPrice(json.estimatedPrice);
        }
        Alert.alert('Success', 'Title, description, and price generated.');
      } else {
        Alert.alert('Generate Text Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Generate text error:', err);
      Alert.alert('Generate Text Failed', err.message || 'Unable to generate product info');
    } finally {
      setIsGenerating(false);
    }
  }

  async function publish() {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please login to publish products');
        return;
      }

      if (!title || !desc || !imageUri) {
        Alert.alert('Validation Error', 'Please fill title, description and image');
        return;
      }

      setIsPublishing(true);

      // Upload image to MongoDB via API
      let imageUrl = imageUri;
      
      // Check if we need to upload (not already a remote URL)
      const isDataUrl = imageUri.startsWith('data:image/');
      const isLocalFile = imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://');
      const isRemoteUrl = imageUri.startsWith('http://') || imageUri.startsWith('https://');
      
      if (isDataUrl || isLocalFile) {
        try {
          let imageBase64 = '';
          
          if (isDataUrl) {
            // Extract base64 data from data URL
            imageBase64 = imageUri.includes(',') ? imageUri : `data:image/jpeg;base64,${imageUri}`;
          } else if (isLocalFile) {
            // For local files, read as base64 and create data URL
            const fileBase64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
            imageBase64 = `data:image/jpeg;base64,${fileBase64}`;
          }
          
          // Upload to MongoDB via API
          const uploadResp = await fetch(`${API_BASE_URL}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              imageBase64,
              userId: user.uid 
            }),
          });
          
          const uploadJson = await uploadResp.json();
          
          if (uploadJson.ok && uploadJson.imageUrl) {
            imageUrl = uploadJson.imageUrl;
          } else {
            throw new Error(uploadJson.error || 'Upload failed');
          }
        } catch (uploadErr: any) {
          console.error('Image upload error:', uploadErr);
          Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
          setIsPublishing(false);
          return;
        }
      } else if (!isRemoteUrl) {
        // If it's neither a data URL, local file, nor remote URL, try using croppedImageBase64
        if (croppedImageBase64 && croppedImageBase64.startsWith('data:image/')) {
          try {
            const uploadResp = await fetch(`${API_BASE_URL}/api/upload-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                imageBase64: croppedImageBase64,
                userId: user.uid 
              }),
            });
            
            const uploadJson = await uploadResp.json();
            
            if (uploadJson.ok && uploadJson.imageUrl) {
              imageUrl = uploadJson.imageUrl;
            } else {
              throw new Error(uploadJson.error || 'Upload failed');
            }
          } catch (uploadErr: any) {
            console.error('Image upload error:', uploadErr);
            Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
            setIsPublishing(false);
            return;
          }
        }
      }

      // Save product to Firestore with MongoDB image URL
      const productData = {
        uid: user.uid,
        title: title.trim(),
        description: desc.trim(),
        price: price ? parseFloat(price) : 0,
        quantity: quantity ? parseInt(quantity, 10) : 1,
        imageUri: imageUrl, // Store Storage URL instead of base64
        marketplaces: { amazon: true, flipkart: true, etsy: true }, // Default: publish to all marketplaces
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      
      // Optional: Call backend API for marketplace submission
      try {
        const payload = {
          title,
          description: desc,
          price,
          quantity,
          marketplaces: { amazon: true, flipkart: true, etsy: true },
          imageUri: imageUrl, // Use Storage URL
          productId: docRef.id,
        };
        const resp = await fetch(`${API_BASE_URL}/api/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (json.ok) {
          console.log('Marketplace submission:', json);
        }
      } catch (apiErr) {
        console.warn('Marketplace API call failed:', apiErr);
        // Don't fail the publish if marketplace API fails
      }

      // Reset form
      setTitle('');
      setDesc('');
      setPrice('');
      setQuantity('1');
      setImageUri(null);
      setCroppedImageBase64(null);

      Alert.alert(
        'Success!',
        'Product published successfully! It will appear in your dashboard and the marketplace.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to dashboard to refresh it
              router.push('/(tabs)');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Publish error:', err);
      Alert.alert('Publish failed', err.message || 'Unable to publish product. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Card style={styles.headerCard}>
        <Text style={styles.headerTitle}>Create New Product</Text>
        <Text style={styles.headerSubtitle}>Add your handmade product to the marketplace</Text>
      </Card>

      <Card style={styles.formCard}>
        <TextInput 
          label="Product Title" 
          value={title} 
          onChangeText={setTitle} 
          mode="outlined"
          style={styles.input}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />
        
        <TextInput 
          label="Description" 
          value={desc} 
          onChangeText={setDesc} 
          multiline 
          numberOfLines={4} 
          mode="outlined" 
          style={styles.input}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />
        
        <View style={styles.priceRow}>
          <View style={styles.priceInputContainer}>
            <TextInput 
              label="Price (₹)" 
              value={price} 
              onChangeText={setPrice} 
              keyboardType="numeric" 
              mode="outlined"
              style={styles.priceInput}
              left={<TextInput.Icon icon="currency-inr" />}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>
          <View style={styles.quantityInputContainer}>
            <TextInput 
              label="Quantity" 
              value={quantity} 
              onChangeText={setQuantity} 
              keyboardType="numeric" 
              mode="outlined"
              style={styles.quantityInput}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>
        </View>
        
        {price ? (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>✨ AI estimated price - you can edit this</Text>
          </View>
        ) : (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>💡 Price will be estimated by AI</Text>
          </View>
        )}
      </Card>

      <Card style={styles.imageCard}>
        <Button 
          mode="outlined" 
          onPress={pickImage} 
          style={styles.imageButton}
          icon="image-plus"
          textColor={colors.primary}
          buttonColor={colors.surface}
        >
          {imageUri ? 'Change Image' : 'Pick Product Image'}
        </Button>
        
        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUri }} 
              style={styles.image} 
              resizeMode="contain"
              onError={() => {
                Alert.alert('Image Error', 'Failed to load image. Please try again.');
              }}
            />
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>📷</Text>
            <Text style={styles.imagePlaceholderLabel}>No image selected</Text>
          </View>
        )}
      </Card>

      <Card style={styles.actionsCard}>
        <Button 
          mode="contained" 
          onPress={cropImage} 
          style={styles.actionButton}
          loading={isEnhancing}
          disabled={isEnhancing}
          buttonColor={colors.secondary}
          icon="crop"
        >
          Enhance Image
        </Button>

        <Button 
          mode="contained" 
          onPress={generateProductInfo} 
          style={styles.actionButton}
          loading={isGenerating}
          disabled={isGenerating}
          buttonColor={colors.accent}
          textColor={colors.textPrimary}
          icon="auto-fix"
        >
          Generate with AI
        </Button>

        <Button 
          mode="contained" 
          onPress={publish} 
          style={[styles.actionButton, styles.publishButton]}
          loading={isPublishing}
          disabled={isPublishing || !title || !desc || !imageUri}
          buttonColor={colors.primary}
          icon="publish"
        >
          Publish Product to Marketplace
        </Button>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.surface,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.9,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  priceInputContainer: {
    flex: 2,
  },
  priceInput: {
    backgroundColor: colors.surface,
  },
  quantityInputContainer: {
    flex: 1,
  },
  quantityInput: {
    backgroundColor: colors.surface,
  },
  hintContainer: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  imageCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  imageButton: {
    marginBottom: spacing.md,
    borderColor: colors.primary,
  },
  imageContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  imagePlaceholderLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionButton: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  publishButton: {
    marginTop: spacing.sm,
    marginBottom: 0,
  },
});