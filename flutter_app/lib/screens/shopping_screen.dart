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

  Future<void> _markDone(Recording item) async {
    await ApiService.updateStatus(item.id, 'done');
    _fetchShopping();
  }

  Future<void> _deleteItem(Recording item) async {
    await ApiService.deleteRecording(item.id);
    _fetchShopping();
  }

  @override
  Widget build(BuildContext context) {
    const categories = [
      'Vegetables', 'Groceries', 'Meat', 'Dairy', 'Grain',
      'Electrical', 'Hardware', 'Fuel', 'Spare Parts', 'Paint', 'Tools'
    ];
    const categoryIcons = {
      'Vegetables': '🥕', 'Groceries': '🛒', 'Meat': '🥩', 'Dairy': '🥛', 'Grain': '🌾',
      'Electrical': '⚡', 'Hardware': '🔩', 'Fuel': '⛽', 'Spare Parts': '⚙️', 'Paint': '🎨', 'Tools': '🛠️'
    };

    // Group by client / store name
    final Map<String, List<Recording>> grouped = {};
    for (var item in _items) {
      final name = (item.client?.name != null && item.client!.name.trim().isNotEmpty)
          ? item.client!.name.trim()
          : 'General Shopping';
      grouped.putIfAbsent(name, () => []).add(item);
    }

    final sortedKeys = grouped.keys.toList()
      ..sort((a, b) {
        if (a == 'General Shopping') return 1;
        if (b == 'General Shopping') return -1;
        return a.toLowerCase().compareTo(b.toLowerCase());
      });

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        title: const Text('🛒 My Shopping', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                : grouped.isEmpty
                    ? const Center(child: Text('No active shopping items.', style: TextStyle(color: Colors.grey)))
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: sortedKeys.map((storeName) {
                          final storeItems = grouped[storeName]!;
                          final Map<String, List<Map<String, dynamic>>> byCat = {};

                          for (var item in storeItems) {
                            String cat = 'Groceries';
                            String itemName = item.summary;
                            if (item.summary.startsWith('[') && item.summary.contains(']')) {
                              final endIdx = item.summary.indexOf(']');
                              final rawCat = item.summary.substring(1, endIdx).trim();
                              final matched = categories.firstWhere(
                                (c) => c.toLowerCase() == rawCat.toLowerCase(),
                                orElse: () => 'Groceries',
                              );
                              cat = matched;
                              itemName = item.summary.substring(endIdx + 1).trim();
                            }
                            byCat.putIfAbsent(cat, () => []).add({'item': item, 'name': itemName});
                          }

                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 2,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF1E3A8A),
                                    borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                                  ),
                                  child: Text(
                                    '🏷️ Store / List: $storeName',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: categories.map((cat) {
                                      final itemsInCat = byCat[cat];
                                      if (itemsInCat == null || itemsInCat.isEmpty) return const SizedBox.shrink();

                                      itemsInCat.sort((a, b) => (a['name'] as String)
                                          .toLowerCase()
                                          .compareTo((b['name'] as String).toLowerCase()));

                                      return Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Padding(
                                            padding: const EdgeInsets.only(top: 12, bottom: 4),
                                            child: Text(
                                              '${categoryIcons[cat] ?? '📦'} $cat'.toUpperCase(),
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF2563EB),
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ),
                                          const Divider(height: 8),
                                          ...itemsInCat.map((entry) {
                                            final item = entry['item'] as Recording;
                                            final name = entry['name'] as String;
                                            return ListTile(
                                              contentPadding: EdgeInsets.zero,
                                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                              subtitle: item.transcript != name
                                                  ? Text(item.transcript, style: const TextStyle(fontSize: 12))
                                                  : null,
                                              trailing: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(Icons.check_circle_outline, color: Colors.green),
                                                    onPressed: () => _markDone(item),
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                                    onPressed: () => _deleteItem(item),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }),
                                        ],
                                      );
                                    }).toList(),
                                  ),
                                )
                              ],
                            ),
                          );
                        }).toList(),
                      ),
          ),
        ],
      ),
    );
  }
}
