import 'package:flutter/material.dart';
import '../models/recording.dart';
import '../services/api_service.dart';

class ShoppingScreen extends StatefulWidget {
  const ShoppingScreen({super.key});
  @override
  State<ShoppingScreen> createState() => _ShoppingScreenState();
}

class _ShoppingScreenState extends State<ShoppingScreen> {
  List<Recording> _items = [];
  bool _loading = false;
  String _authEmail = '';

  @override
  void initState() {
    super.initState();
    _loadUser();
    _fetchShopping();
  }

  Future<void> _loadUser() async {
    final email = await ApiService.getAuthEmail();
    if (email != null && mounted) {
      setState(() => _authEmail = email);
    }
  }

  Future<void> _fetchShopping() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.getActiveShopping();
      setState(() { _items = data; _loading = false; });
    } catch (e) {
      setState(() { _loading = false; });
    }
  }

  Future<void> _deleteItem(String id) async {
    try {
      await ApiService.deleteShoppingItem(id);
      _fetchShopping();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        title: const Text('🛒 My Shopping List', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: Column(
        children: [
          if (_authEmail.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
              color: const Color(0xFFEFF6FF),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.person, size: 16, color: Color(0xFF1D4ED8)),
                  const SizedBox(width: 6),
                  Text(
                    'Logged in as: $_authEmail',
                    style: const TextStyle(color: Color(0xFF1D4ED8), fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                : _items.isEmpty
                    ? const Center(child: Text('No active shopping items.', style: TextStyle(color: Colors.grey, fontSize: 16)))
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        separatorBuilder: (ctx, i) => const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          
                          // Support both ShoppingItem (item_name) and Recording (summary) formats
                          String displayName = item.summary;
                          if (displayName.startsWith('[') && displayName.contains(']')) {
                            final endIdx = displayName.indexOf(']');
                            displayName = displayName.substring(endIdx + 1).trim();
                          }

                          return Container(
                            decoration: BoxDecoration(
                              color: index % 2 == 0 ? Colors.white : const Color(0xFFFAFAFA),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                              title: Text(
                                displayName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.red),
                                onPressed: () => _deleteItem(item.id),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
