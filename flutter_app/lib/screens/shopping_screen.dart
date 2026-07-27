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
  bool _showAllShopping = false;

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

  Future<void> _markMultipleDone(List<Recording> items) async {
    setState(() => _loading = true);
    for (var item in items) {
      try { await ApiService.updateStatus(item.id, 'done'); } catch (_) {}
    }
    _fetchShopping();
  }

  Future<void> _deleteMultiple(List<Recording> items) async {
    setState(() => _loading = true);
    for (var item in items) {
      try { await ApiService.deleteRecording(item.id); } catch (_) {}
    }
    _fetchShopping();
  }

  Future<void> _showEditDialog(Recording item, String currentName) async {
    final nameCtrl = TextEditingController(text: currentName);
    final transCtrl = TextEditingController(text: item.transcript);
    
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        bool isCleaning = false;
        bool isSummarizing = false;

        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              title: const Text('Edit Item'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Summary / Name')),
                    const SizedBox(height: 8),
                    TextField(controller: transCtrl, decoration: const InputDecoration(labelText: 'Transcript'), maxLines: 4),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: isCleaning ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.auto_fix_high, size: 16),
                            label: const Text('Clean', style: TextStyle(fontSize: 12)),
                            onPressed: isCleaning ? null : () async {
                              setStateDialog(() => isCleaning = true);
                              try {
                                final updated = await ApiService.cleanTranscript(item.id, transCtrl.text.trim());
                                transCtrl.text = updated.transcript;
                              } catch (e) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                              } finally {
                                setStateDialog(() => isCleaning = false);
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: isSummarizing ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.short_text, size: 16),
                            label: const Text('Name', style: TextStyle(fontSize: 12)),
                            onPressed: isSummarizing ? null : () async {
                              setStateDialog(() => isSummarizing = true);
                              try {
                                final updated = await ApiService.resummarize(item.id, transCtrl.text.trim());
                                // For shopping items, updated.summary has the category prepended like "[Groceries] item name"
                                // Try to extract just the item name
                                String newName = updated.summary;
                                if (newName.startsWith('[') && newName.contains(']')) {
                                  final endIdx = newName.indexOf(']');
                                  newName = newName.substring(endIdx + 1).trim();
                                }
                                nameCtrl.text = newName;
                              } catch (e) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                              } finally {
                                setStateDialog(() => isSummarizing = false);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
              ],
            );
          }
        );
      }
    );
    
    if (result == true) {
      // Re-attach category if it was stripped
      String newSummary = nameCtrl.text.trim();
      if (item.summary.startsWith('[') && item.summary.contains(']')) {
        final endIdx = item.summary.indexOf(']');
        final prefix = item.summary.substring(0, endIdx + 1);
        newSummary = '$prefix $newSummary';
      }
      
      setState(() => _loading = true);
      try {
        await ApiService.updateText(item.id, newSummary, transCtrl.text.trim());
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to save: $e'), backgroundColor: Colors.red),
          );
        }
      } finally {
        _fetchShopping();
      }
    }
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

    // Flat Unique Items for "All Shopping" view
    final Map<String, List<Recording>> flatUniqueItems = {};
    for (var item in _items) {
      String itemName = item.summary;
      if (item.summary.startsWith('[') && item.summary.contains(']')) {
        final endIdx = item.summary.indexOf(']');
        itemName = item.summary.substring(endIdx + 1).trim();
      }
      final lowerName = itemName.toLowerCase();
      flatUniqueItems.putIfAbsent(lowerName, () => []).add(item);
    }
    final flatUniqueKeys = flatUniqueItems.keys.toList()..sort();

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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Text('All Shopping', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A))),
                Switch(
                  value: _showAllShopping,
                  activeColor: const Color(0xFF2563EB),
                  onChanged: (val) => setState(() => _showAllShopping = val),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                : (_showAllShopping ? flatUniqueItems.isEmpty : grouped.isEmpty)
                    ? const Center(child: Text('No active shopping items.', style: TextStyle(color: Colors.grey)))
                    : _showAllShopping
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: flatUniqueKeys.map((key) {
                            final itemsInGroup = flatUniqueItems[key]!;
                            final primaryItem = itemsInGroup.first;
                            String displayName = primaryItem.summary;
                            if (displayName.startsWith('[') && displayName.contains(']')) {
                              final endIdx = displayName.indexOf(']');
                              displayName = displayName.substring(endIdx + 1).trim();
                            }
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: itemsInGroup.length > 1 ? Text('${itemsInGroup.length} instances') : null,
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.check_circle_outline, color: Colors.green),
                                      onPressed: () => _markMultipleDone(itemsInGroup),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                                      onPressed: () => _deleteMultiple(itemsInGroup),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        )
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
                                              onTap: () => _showEditDialog(item, name),
                                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                              subtitle: item.transcript != name
                                                  ? Text(item.transcript, style: const TextStyle(fontSize: 12))
                                                  : null,
                                              trailing: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(Icons.edit, color: Colors.blueGrey),
                                                    onPressed: () => _showEditDialog(item, name),
                                                  ),
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
