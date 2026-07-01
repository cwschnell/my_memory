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

  @override
  void initState() {
    super.initState();
    _fetchShopping();
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
    // Group by client / category name
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
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
        : grouped.isEmpty
          ? const Center(child: Text('No active shopping items.', style: TextStyle(color: Colors.grey)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: sortedKeys.map((key) {
                final items = grouped[key]!;
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
                          '🏷️ Category / Store: $key',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      ...items.map((item) {
                        return ListTile(
                          title: Text(item.summary, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(item.transcript),
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
                      }).toList()
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }
}
