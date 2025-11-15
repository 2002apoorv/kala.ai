import { Link, useRouter } from 'expo-router';
import { QueryDocumentSnapshot, Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import { db } from '../firebase/firebase';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

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

type ArtisanInfo = {
  name?: string;
  location?: string;
};

export default function Marketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [artisanInfoMap, setArtisanInfoMap] = useState<Record<string, ArtisanInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

  async function fetchArtisanInfo(uid: string): Promise<ArtisanInfo | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          name: data.name || undefined,
          location: data.location || undefined,
        };
      }
    } catch (err: any) {
      // Silently fail for artisan info - not critical for marketplace display
      // Permission errors can occur if rules aren't deployed or user doesn't exist
      if (err.code === 'permission-denied') {
        // This is expected if Firestore rules haven't been updated
        // The marketplace will still work without artisan names
        console.warn('Artisan info access denied (rules may need deployment):', uid);
      } else {
        console.error('Error fetching artisan info:', err);
      }
    }
    return null;
  }

  async function fetchProducts(reset = false) {
    try {
      if (reset) {
        setProducts([]);
        setLastVisible(null);
        setHasMore(true);
      }

      let productsQuery;
      let useOrderBy = true;
      let snapshot;

      try {
        // Try to use orderBy first (requires index)
        if (lastVisible && !reset) {
          productsQuery = query(
            collection(db, 'products'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            startAfter(lastVisible),
            limit(20)
          );
        } else {
          productsQuery = query(
            collection(db, 'products'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
        }
        snapshot = await getDocs(productsQuery);
      } catch (queryErr: any) {
        // If query fails due to missing index, use simple query without orderBy
        if (queryErr.code === 'failed-precondition' || queryErr.message?.includes('index')) {
          console.warn('Firestore index needed. Using simple query without orderBy.');
          useOrderBy = false;
          try {
            productsQuery = query(
              collection(db, 'products'),
              where('status', '==', 'published'),
              limit(20)
            );
            snapshot = await getDocs(productsQuery);
          } catch (fallbackErr: any) {
            console.error('Fallback query failed:', fallbackErr);
            throw fallbackErr;
          }
        } else {
          throw queryErr;
        }
      }
      
      if (snapshot.empty) {
        setHasMore(false);
        if (reset) setProducts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const productsList: Product[] = [];
      const artisanUids = new Set<string>();

      snapshot.forEach((docSnapshot) => {
        try {
          const data = docSnapshot.data();
          // Ensure all required fields exist
          if (data && data.status === 'published') {
            const productData: Product = {
              id: docSnapshot.id,
              title: data.title || 'Untitled',
              description: data.description || '',
              price: typeof data.price === 'number' ? data.price : 0,
              quantity: typeof data.quantity === 'number' ? data.quantity : 1,
              imageUri: data.imageUri || '',
              status: data.status || 'published',
              createdAt: data.createdAt || null,
              uid: data.uid || '',
            };
            productsList.push(productData);
            if (productData.uid) {
              artisanUids.add(productData.uid);
            }
          }
        } catch (docErr) {
          console.error('Error processing product document:', docErr);
        }
      });

      // Sort manually if orderBy wasn't used
      if (!useOrderBy && productsList.length > 0) {
        productsList.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          try {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          } catch {
            return 0;
          }
        });
      }

      if (reset) {
        setProducts(productsList);
      } else {
        setProducts((prev) => [...prev, ...productsList]);
      }

      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 20);
      } else {
        setHasMore(false);
      }

      // Fetch artisan info for all unique artisans (don't block on this)
      const infoMap: Record<string, ArtisanInfo> = { ...artisanInfoMap };
      Promise.all(
        Array.from(artisanUids).map(async (uid) => {
          if (!infoMap[uid]) {
            const info = await fetchArtisanInfo(uid);
            if (info) {
              infoMap[uid] = info;
            }
          }
        })
      ).then(() => {
        setArtisanInfoMap(infoMap);
      }).catch((err) => {
        console.error('Error fetching artisan info batch:', err);
      });

    } catch (err: any) {
      console.error('Error fetching products:', err);
      
      // Handle different error types
      if (err.code === 'permission-denied') {
        console.error('Permission denied. Check Firestore security rules.');
        if (reset && Platform.OS !== 'web') {
          Alert.alert(
            'Permission Error',
            'Unable to load marketplace. Please check your Firestore security rules.'
          );
        }
      } else if (err.code === 'failed-precondition') {
        // Already handled above, but catch any remaining cases
        console.warn('Firestore index required. Some features may not work correctly.');
      } else if (err.code === 'unavailable') {
        console.error('Firestore service unavailable. Please check your connection.');
      }
      
      // Try fallback query as last resort
      if (reset) {
        try {
          const simpleQuery = query(
            collection(db, 'products'),
            where('status', '==', 'published'),
            limit(20)
          );
          const snapshot = await getDocs(simpleQuery);
          const productsList: Product[] = [];
          snapshot.forEach((docSnapshot) => {
            try {
              const data = docSnapshot.data();
              if (data && data.status === 'published') {
                productsList.push({
                  id: docSnapshot.id,
                  ...data,
                } as Product);
              }
            } catch (docErr) {
              console.error('Error in fallback processing:', docErr);
            }
          });
          setProducts(productsList);
          setHasMore(false);
        } catch (fallbackErr: any) {
          console.error('Fallback query failed:', fallbackErr);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchProducts(true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts(true);
  };

  const loadMore = () => {
    if (!loading && hasMore && !refreshing) {
      fetchProducts(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.title.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query) ||
      (artisanInfoMap[product.uid]?.name || '').toLowerCase().includes(query) ||
      (artisanInfoMap[product.uid]?.location || '').toLowerCase().includes(query)
    );
  });

  if (loading && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Text style={styles.headerTitle}>🛍️ Kala.ai Marketplace</Text>
        <Text style={styles.headerSubtitle}>
          Discover unique handmade products from artisans
        </Text>
        <TextInput
          label="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          style={styles.searchInput}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />
      </Card>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>
            {searchQuery ? '🔍' : '🎨'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No products match your search.' : 'No products available yet.'}
          </Text>
        </Card>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            hasMore && !searchQuery ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const artisanInfo = artisanInfoMap[item.uid];
            return (
              <Card
                style={styles.productCard}
                onPress={() => router.push(`/product/${item.id}` as any)}
              >
                <Link href={`/product/${item.id}` as any}>
                  {item.imageUri ? (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Text style={styles.productImagePlaceholderText}>📷</Text>
                    </View>
                  )}
                  <View style={styles.productContent}>
                    <Text style={styles.productTitle}>
                      {item.title}
                    </Text>
                    {artisanInfo?.name && (
                      <Text style={styles.productArtisan}>
                        by {artisanInfo.name}
                        {artisanInfo.location && ` • ${artisanInfo.location}`}
                      </Text>
                    )}
                    <Text
                      style={styles.productDescription}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                    <View style={styles.productFooter}>
                      <View>
                        <Text style={styles.productPrice}>
                          ₹{item.price}
                        </Text>
                        <Text style={styles.productQuantity}>
                          {item.quantity} available
                        </Text>
                      </View>
                    </View>
                  </View>
                </Link>
              </Card>
            );
          }}
        />
      )}
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
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary,
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
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
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
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  productCard: {
    marginHorizontal: spacing.md,
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
  productImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.background,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 64,
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
  productArtisan: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  productQuantity: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerLoader: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});

