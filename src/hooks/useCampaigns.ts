*** Begin Patch
*** Update File: src/hooks/useCampaigns.ts
@@
-    refetch: () => {
-      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
-    },
+    refetch: () => {
+      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
+    },
   };
 }
*** End Patch