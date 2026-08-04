import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import '../models/shopping_item.dart';
import '../services/api_service.dart';
import '../config.dart';

class ShoppingScreen extends StatefulWidget {
  const ShoppingScreen({super.key});
  @override
  State<ShoppingScreen> createState() => _ShoppingScreenState();
}

class _ShoppingScreenState extends State<ShoppingScreen> {
  List<ShoppingItemModel> _items = [];
  bool _loading = false;
  String _authEmail = '';
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

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

  Future<void> _showEditDialog(ShoppingItemModel item) async {
    final nameCtrl = TextEditingController(text: item.itemName);
    final contextCtrl = TextEditingController(text: item.itemName);
    
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        bool isCleaning = false;
        bool isSummarizing = false;

        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              title: const Text('Edit Shopping Item'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Item Name')),
                    const SizedBox(height: 8),
                    TextField(controller: contextCtrl, decoration: const InputDecoration(labelText: 'Context (for LLM)'), maxLines: 2),
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
                                final updatedName = await ApiService.cleanShoppingItem(item.id, contextCtrl.text.trim());
                                contextCtrl.text = updatedName;
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
                                final updatedName = await ApiService.resummarizeShoppingItem(item.id, contextCtrl.text.trim());
                                nameCtrl.text = updatedName;
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
      setState(() => _loading = true);
      try {
        await ApiService.updateShoppingItemName(item.id, nameCtrl.text.trim());
        _fetchShopping();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update: $e')));
        }
        setState(() => _loading = false);
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
                          
                          String displayName = item.itemName;
                          if (displayName.startsWith('[') && displayName.contains(']')) {
                            final endIdx = displayName.indexOf(']');
                            displayName = displayName.substring(endIdx + 1).trim();
                          }

                          return Container(
                            decoration: BoxDecoration(
                              color: index % 2 == 0 ? Colors.white : const Color(0xFFFAFAFA),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: InkWell(
                              onTap: () => _showEditDialog(item),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                title: Text(
                                  displayName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.volume_up, color: Colors.blueGrey),
                                      onPressed: () async {
                                        final url = '$BASE_URL/recordings/shopping/${item.id}/speak';
                                        await _audioPlayer.play(UrlSource(url));
                                      },
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                                      onPressed: () => _deleteItem(item.id),
                                    ),
                                  ],
                                ),
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
