import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../models/recording.dart';
import '../services/api_service.dart';
import '../config.dart';

class ListScreen extends StatefulWidget {
  const ListScreen({super.key});
  @override
  State<ListScreen> createState() => _ListScreenState();
}

class _ListScreenState extends State<ListScreen> {
  DateTime _selectedDate = DateTime.now();
  List<Recording> _recordings = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _fetchRecordings();
  }

  Future<void> _fetchRecordings() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.getByDate(_selectedDate);
      setState(() { _recordings = data; _loading = false; });
    } catch (e) {
      setState(() { _loading = false; });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      _fetchRecordings();
    }
  }

  Future<void> _rescheduleDate(Recording rec) async {
    final now = DateTime.now();
    final initial = rec.dateRecorded != null && rec.dateRecorded!.isAfter(now) ? rec.dateRecorded! : now.add(const Duration(days: 1));
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      await ApiService.updateStatus(rec.id, 'postpone');
      await ApiService.updateDate(rec.id, picked);
      _fetchRecordings();
    }
  }

  Future<void> _deleteRecording(Recording rec) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Message'),
        content: Text('Are you sure you want to delete "${rec.summary}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true), 
            child: const Text('Delete')
          ),
        ],
      )
    );
    if (confirm == true) {
      await ApiService.deleteRecording(rec.id);
      _fetchRecordings();
    }
  }

  void _showDetailModal(Recording rec) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(rec.summary, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A))),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: () {
                      Navigator.pop(context);
                      _deleteRecording(rec);
                    },
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Recorded at ${DateFormat('HH:mm on dd MMM yyyy').format(rec.createdAt)}',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const Divider(height: 24),
              const Text('English Transcript:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF475569))),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Text(
                  rec.transcript,
                  style: const TextStyle(fontSize: 15, height: 1.5, color: Color(0xFF1E293B)),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_month),
                      label: const Text('Move Date'),
                      onPressed: () {
                        Navigator.pop(context);
                        _rescheduleDate(rec);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.open_in_browser),
                      label: const Text('Open Web'),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
                      onPressed: () async {
                        final host = BASE_URL.replaceAll('http://', '').split(':')[0];
                        final uri = Uri.parse('http://$host:5173/message/${rec.id}');
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                    ),
                  ),
                ],
              )
            ],
          ),
        );
      },
    );
  }

  Future<void> _updateStatus(Recording rec, String status) async {
    await ApiService.updateStatus(rec.id, status);
    _fetchRecordings();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'urgent': return const Color(0xFFDC2626);
      case 'done': return const Color(0xFF16A34A);
      case 'postpone': return const Color(0xFF64748B);
      default: return const Color(0xFF2563EB);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        elevation: 0,
        title: const Text('📋 My Memos', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today, color: Colors.white),
            onPressed: _pickDate,
          )
        ],
      ),
      body: Column(
        children: [
          GestureDetector(
            onTap: _pickDate,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: const Color(0xFF2563EB),
              child: Text(
                DateFormat('EEEE, d MMMM yyyy').format(_selectedDate),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Container(
            color: const Color(0xFFE2E8F0),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            child: const Row(
              children: [
                Expanded(flex: 3, child: Text('Message Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155)))),
                SizedBox(width: 48, child: Text('Urgent', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF334155)))),
                SizedBox(width: 48, child: Text('Done', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF334155)))),
                SizedBox(width: 56, child: Text('Postpone', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF334155)))),
              ],
            ),
          ),
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
              : _recordings.isEmpty
                ? const Center(child: Text('No memory memos for this date.', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _recordings.length,
                    itemBuilder: (context, index) {
                      final rec = _recordings[index];
                      return Dismissible(
                        key: Key(rec.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          color: Colors.red,
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 20),
                          child: const Icon(Icons.delete, color: Colors.white),
                        ),
                        onDismissed: (_) async {
                          await ApiService.deleteRecording(rec.id);
                        },
                        child: Container(
                          decoration: const BoxDecoration(
                            border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          color: index.isEven ? Colors.white : const Color(0xFFF8FAFC),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: GestureDetector(
                                    onTap: () => _showDetailModal(rec),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            if (rec.status == 'urgent')
                                              const Padding(
                                                padding: EdgeInsets.only(right: 4),
                                                child: Icon(Icons.priority_high, size: 16, color: Colors.red),
                                              ),
                                            Expanded(
                                              child: Text(
                                                rec.summary,
                                                style: TextStyle(
                                                  color: _statusColor(rec.status),
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 15,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          DateFormat('HH:mm').format(rec.createdAt),
                                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: 48,
                                  child: Radio<String>(
                                    value: 'urgent',
                                    groupValue: rec.status,
                                    activeColor: const Color(0xFFDC2626),
                                    onChanged: (v) => _updateStatus(rec, v!),
                                  ),
                                ),
                                SizedBox(
                                  width: 48,
                                  child: Radio<String>(
                                    value: 'done',
                                    groupValue: rec.status,
                                    activeColor: const Color(0xFF16A34A),
                                    onChanged: (v) => _updateStatus(rec, v!),
                                  ),
                                ),
                                SizedBox(
                                  width: 56,
                                  child: Radio<String>(
                                    value: 'postpone',
                                    groupValue: rec.status,
                                    activeColor: const Color(0xFF64748B),
                                    onChanged: (v) => _rescheduleDate(rec),
                                  ),
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
