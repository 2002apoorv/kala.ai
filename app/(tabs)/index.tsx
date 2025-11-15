import { Link, useFocusEffect, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, FAB, Text } from 'react-native-paper';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import { auth, db } from '../../firebase/firebase';


type UserProfile = {
uid?: string;
email?: string;
name?: string;
location?: string;
};

type Product = {
id: string;
title: string;
description: string;
price: number;
quantity: number;
imageUri: string;
status: string;
createdAt: Timestamp | null;
uid: string;
};


export default function Home() {
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [deletingId, setDeletingId] = useState<string | null>(null);
const router = useRouter();


async function fetchProducts() {
try {
const user = auth.currentUser;
if (!user) {
setProducts([]);
setLoading(false);
setRefreshing(false);
return;
}

let productsList: Product[] = [];
let useOrderBy = true;

try {
// Try query with orderBy first (requires composite index)
const productsQuery = query(
collection(db, 'products'),
where('uid', '==', user.uid),
where('status', '==', 'published'),
orderBy('createdAt', 'desc')
);

const snapshot = await getDocs(productsQuery);
snapshot.forEach((doc) => {
productsList.push({ id: doc.id, ...doc.data() } as Product);
});
} catch (queryErr: any) {
// If query fails due to missing index, use simple query without orderBy
if (queryErr.code === 'failed-precondition' || queryErr.message?.includes('index')) {
console.warn('Firestore index needed. Using simple query without orderBy.');
useOrderBy = false;
try {
const simpleQuery = query(
collection(db, 'products'),
where('uid', '==', user.uid),
where('status', '==', 'published')
);
const snapshot = await getDocs(simpleQuery);
snapshot.forEach((doc) => {
productsList.push({ id: doc.id, ...doc.data() } as Product);
});

// Sort manually since we couldn't use orderBy
if (productsList.length > 0) {
productsList.sort((a, b) => {
if (!a.createdAt || !b.createdAt) return 0;
try {
return b.createdAt.toMillis() - a.createdAt.toMillis();
} catch {
return 0;
}
});
}
} catch (fallbackErr: any) {
console.error('Fallback query also failed:', fallbackErr);
// Last resort: query without status filter
try {
const basicQuery = query(
collection(db, 'products'),
where('uid', '==', user.uid)
);
const snapshot = await getDocs(basicQuery);
snapshot.forEach((doc) => {
const data = doc.data();
if (data.status === 'published') {
productsList.push({ id: doc.id, ...data } as Product);
}
});
// Sort manually
if (productsList.length > 0) {
productsList.sort((a, b) => {
if (!a.createdAt || !b.createdAt) return 0;
try {
return b.createdAt.toMillis() - a.createdAt.toMillis();
} catch {
return 0;
}
});
}
} catch (lastErr) {
console.error('All query attempts failed:', lastErr);
}
}
} else {
// Some other error occurred
throw queryErr;
}
}

setProducts(productsList);
} catch (err: any) {
console.error('Error fetching products:', err);
// Don't show empty list on error - keep previous products if available
} finally {
setLoading(false);
setRefreshing(false);
}
}


useEffect(() => {
const unsub = onAuthStateChanged(auth, async (user) => {
if (user) {
const ref = doc(db, 'users', user.uid);
const snap = await getDoc(ref);
if (snap.exists()) setUserProfile(snap.data() as UserProfile);
else setUserProfile({ uid: user.uid, email: user.email || '' });
await fetchProducts();
} else {
setUserProfile(null);
setProducts([]);
setLoading(false);
}
});
return unsub;
}, []);

// Refresh products when screen comes into focus (e.g., after publishing)
useFocusEffect(
useCallback(() => {
if (auth.currentUser) {
fetchProducts();
}
}, [])
);


const onRefresh = async () => {
setRefreshing(true);
await fetchProducts();
};

async function deleteProduct(productId: string, productTitle: string) {
Alert.alert(
'Delete Product',
`Are you sure you want to delete "${productTitle}"? This action cannot be undone.`,
[
{
text: 'Cancel',
style: 'cancel',
},
{
text: 'Delete',
style: 'destructive',
onPress: async () => {
try {
setDeletingId(productId);
const productRef = doc(db, 'products', productId);
await deleteDoc(productRef);
// Refresh the products list
await fetchProducts();
Alert.alert('Success', 'Product deleted successfully');
} catch (err: any) {
console.error('Delete error:', err);
Alert.alert('Delete Failed', err.message || 'Unable to delete product. Please try again.');
} finally {
setDeletingId(null);
}
},
},
]
);
}


if (loading) {
return (
<View style={styles.loadingContainer}>
<ActivityIndicator size="large" color={colors.primary} />
</View>
);
}

return (
<View style={styles.container}>
<Card style={styles.headerCard}>
<View style={styles.headerContent}>
<View>
<Text style={styles.headerTitle}>
{userProfile ? `👋 ${userProfile.name || 'Artisan'}` : 'Kala.ai'}
</Text>
<Text style={styles.headerSubtitle}>
{userProfile?.location || userProfile?.email || 'Welcome back!'}
</Text>
</View>
<View style={styles.statsContainer}>
<Text style={styles.statsNumber}>{products.length}</Text>
<Text style={styles.statsLabel}>Products</Text>
</View>
</View>
<Link href="/marketplace" style={styles.marketplaceLink}>
<View style={styles.marketplaceButton}>
<Text style={styles.marketplaceButtonText}>Explore Marketplace →</Text>
</View>
</Link>
</Card>

{products.length === 0 ? (
<Card style={styles.emptyCard}>
<Text style={styles.emptyIcon}>🎨</Text>
<Text style={styles.emptyTitle}>No products yet</Text>
<Text style={styles.emptyText}>
Create your first handmade product and share it with the world!
</Text>
<Link href="/(tabs)/profile" style={styles.emptyButton}>
<View style={styles.emptyButtonContent}>
<Text style={styles.emptyButtonText}>Create Product</Text>
</View>
</Link>
</Card>
) : (
<FlatList
data={products}
keyExtractor={(item) => item.id}
refreshControl={
<RefreshControl 
refreshing={refreshing} 
onRefresh={onRefresh}
colors={[colors.primary]}
tintColor={colors.primary}
/>
}
contentContainerStyle={styles.listContent}
renderItem={({ item }) => (
<Card style={styles.productCard}>
{item.imageUri ? (
<View style={styles.productImageContainer}>
<Image 
source={{ uri: item.imageUri }} 
style={styles.productImage}
resizeMode="cover"
onError={(error) => {
console.error('Image load error:', error);
}}
/>
</View>
) : (
<View style={styles.productImageContainer}>
<View style={styles.productImagePlaceholder}>
<Text style={styles.productImageText}>📷</Text>
</View>
</View>
)}
<View style={styles.productContent}>
<Text style={styles.productTitle}>{item.title}</Text>
<Text style={styles.productDescription} numberOfLines={2}>
{item.description}
</Text>
<View style={styles.productFooter}>
<View>
<Text style={styles.productPrice}>₹{item.price}</Text>
<Text style={styles.productQuantity}>{item.quantity} available</Text>
</View>
<View style={styles.productActions}>
<Link href={`/product/${item.id}` as any}>
<View style={styles.viewButton}>
<Text style={styles.viewButtonText}>View →</Text>
</View>
</Link>
<Button
mode="outlined"
onPress={() => deleteProduct(item.id, item.title)}
style={styles.deleteButton}
textColor={colors.error}
icon="delete"
loading={deletingId === item.id}
disabled={deletingId === item.id || deletingId !== null}
compact
>
Delete
</Button>
</View>
</View>
</View>
</Card>
)}
/>
)}


<Link href="/(tabs)/profile" asChild>
<FAB 
icon="plus" 
style={styles.fab}
color={colors.surface}
/>
</Link>
</View>
);
}

const styles = StyleSheet.create({
loadingContainer: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
backgroundColor: colors.background,
},
container: {
flex: 1,
backgroundColor: colors.background,
},
headerCard: {
backgroundColor: colors.primary,
padding: spacing.lg,
margin: spacing.md,
marginBottom: spacing.md,
borderRadius: borderRadius.lg,
elevation: 4,
shadowColor: colors.shadow,
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 8,
},
headerContent: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: spacing.md,
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
statsContainer: {
alignItems: 'center',
backgroundColor: 'rgba(255, 255, 255, 0.2)',
paddingHorizontal: spacing.md,
paddingVertical: spacing.sm,
borderRadius: borderRadius.md,
},
statsNumber: {
...typography.h2,
color: colors.surface,
},
statsLabel: {
...typography.caption,
color: colors.surface,
opacity: 0.9,
},
marketplaceLink: {
marginTop: spacing.sm,
},
marketplaceButton: {
backgroundColor: 'rgba(255, 255, 255, 0.2)',
paddingVertical: spacing.sm,
paddingHorizontal: spacing.md,
borderRadius: borderRadius.md,
alignItems: 'center',
},
marketplaceButtonText: {
...typography.bodySmall,
color: colors.surface,
fontWeight: '600',
},
emptyCard: {
margin: spacing.md,
padding: spacing.xl,
backgroundColor: colors.surface,
borderRadius: borderRadius.lg,
alignItems: 'center',
elevation: 2,
shadowColor: colors.shadow,
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.05,
shadowRadius: 4,
},
emptyIcon: {
fontSize: 64,
marginBottom: spacing.md,
},
emptyTitle: {
...typography.h3,
color: colors.textPrimary,
marginBottom: spacing.sm,
},
emptyText: {
...typography.body,
color: colors.textSecondary,
textAlign: 'center',
marginBottom: spacing.lg,
},
emptyButton: {
width: '100%',
},
emptyButtonContent: {
backgroundColor: colors.primary,
paddingVertical: spacing.md,
paddingHorizontal: spacing.lg,
borderRadius: borderRadius.md,
alignItems: 'center',
},
emptyButtonText: {
...typography.body,
color: colors.surface,
fontWeight: '600',
},
listContent: {
padding: spacing.md,
paddingBottom: spacing.xxl,
},
productCard: {
marginBottom: spacing.md,
backgroundColor: colors.surface,
borderRadius: borderRadius.lg,
overflow: 'hidden',
elevation: 2,
shadowColor: colors.shadow,
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.05,
shadowRadius: 4,
},
productImageContainer: {
width: '100%',
height: 180,
backgroundColor: colors.background,
overflow: 'hidden',
borderTopLeftRadius: borderRadius.lg,
borderTopRightRadius: borderRadius.lg,
},
productImage: {
width: '100%',
height: '100%',
},
productImagePlaceholder: {
width: '100%',
height: '100%',
justifyContent: 'center',
alignItems: 'center',
},
productImageText: {
fontSize: 48,
opacity: 0.3,
},
productContent: {
padding: spacing.md,
},
productTitle: {
...typography.h3,
color: colors.textPrimary,
marginBottom: spacing.xs,
},
productDescription: {
...typography.bodySmall,
color: colors.textSecondary,
marginBottom: spacing.md,
},
productFooter: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
},
productPrice: {
...typography.h3,
color: colors.primary,
marginBottom: spacing.xs,
},
productQuantity: {
...typography.caption,
color: colors.textSecondary,
},
productActions: {
flexDirection: 'row',
gap: spacing.sm,
alignItems: 'center',
},
viewButton: {
backgroundColor: colors.primaryLight,
paddingVertical: spacing.sm,
paddingHorizontal: spacing.md,
borderRadius: borderRadius.md,
},
viewButtonText: {
...typography.bodySmall,
color: colors.surface,
fontWeight: '600',
},
deleteButton: {
borderColor: colors.error,
},
fab: {
position: 'absolute',
right: spacing.md,
bottom: spacing.md,
backgroundColor: colors.primary,
},
});

