import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';

import { db } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import FilterBar from '../../src/components/FilterBar';
import StatusBadge from '../../src/components/StatusBadge';
import { COLORS } from '../../src/constants/theme';

import { format } from 'date-fns';

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Printer } from '@capgo/capacitor-printer';

import {
  PdfGenerator,
  PageSize,
  Orientation,
} from '@capawesome/capacitor-pdf-generator';

// ============================================================
// HELPERS
// ============================================================

const fmtDate = (d) => {
  try {
    return format(new Date(d), 'dd MMM yyyy');
  } catch {
    return d || '—';
  }
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};


// ============================================================
// GET LOGO AS BASE64
// ============================================================
const getLogoSource = async () => {
  try {
    const asset = Asset.fromModule(
      require('../../assets/mist-logo.png')
    );

    await asset.downloadAsync();

    // Web:
    // Use the asset URL directly.
    if (Platform.OS === 'web') {
      return asset.uri;
    }

    // Android / iOS:
    // Use Base64 because local image URLs can have
    // compatibility issues with HTML printing.
    const base64 = await FileSystem.readAsStringAsync(
      asset.localUri || asset.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    return `data:image/png;base64,${base64}`;

  } catch (error) {

    console.warn(
      'Could not load MIST logo:',
      error
    );

    return null;
  }
};

// ============================================================
// CREATE HTML REPORT
// ============================================================

const createReportHTML = async ({
  records,
  department,
  filters,
}) => {
const logo = await getLogoSource();

  const generatedDate = format(
    new Date(),
    'dd MMM yyyy, hh:mm a'
  );

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  const total = records.length;

  const returned = records.filter(
    r =>
      String(r.status || '').toLowerCase() === 'returned'
  ).length;

  const pending = records.filter(
    r =>
      String(r.status || '').toLowerCase() === 'pending'
  ).length;

  const overdue = records.filter(
    r =>
      String(r.status || '').toLowerCase() === 'overdue'
  ).length;


  // ----------------------------------------------------------
  // RECORD ROWS
  // ----------------------------------------------------------

  const rows = records.map((r, index) => {

    const status = String(
      r.status || '—'
    ).toUpperCase();

    let statusClass = 'status-default';

    if (status === 'RETURNED') {
      statusClass = 'status-returned';
    } else if (status === 'PENDING') {
      statusClass = 'status-pending';
    } else if (status === 'OVERDUE') {
      statusClass = 'status-overdue';
    }

    return `
      <tr>

        <td class="center">
          ${index + 1}
        </td>

        <td>
          <strong>
            ${escapeHtml(r.studentName || '—')}
          </strong>
          <br/>

          <span class="small">
            ${escapeHtml(r.rank || '')}
          </span>
        </td>

        <td>
          ${escapeHtml(r.serviceNumber || '—')}
        </td>

        <td>
          ${escapeHtml(fmtDate(r.date))}
        </td>

        <td class="center">
          ${escapeHtml(r.outTime || '—')}
        </td>

        <td class="center">
          ${escapeHtml(r.expectedReturn || '—')}
        </td>

        <td class="center">
          ${escapeHtml(r.actualReturn || '—')}
        </td>

        <td class="center">
          <span class="status ${statusClass}">
            ${escapeHtml(status)}
          </span>
        </td>

      </tr>
    `;
  }).join('');


  // ----------------------------------------------------------
  // FILTER INFORMATION
  // ----------------------------------------------------------

  const statusFilter =
    filters?.status
      ? filters.status
      : 'All';

  const dateFrom =
    filters?.dateFrom
      ? filters.dateFrom
      : '—';

  const dateTo =
    filters?.dateTo
      ? filters.dateTo
      : '—';


  // ----------------------------------------------------------
  // HTML
  // ----------------------------------------------------------

  return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

@page {
  size: A4 portrait;
  margin: 14mm 12mm 16mm 12mm;
}

* {
  box-sizing: border-box;
}

body {

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color: #111;

  margin: 0;

  font-size: 10px;

}


/* =========================================================
   HEADER
   ========================================================= */

.header {

  text-align: center;

  border-bottom:
    2px solid #1d1d1d;

  padding-bottom: 10px;

  margin-bottom: 12px;

}

.logo {

  width: 95px;

  height: auto;

  margin-bottom: 5px;

}

.institute {

  font-size: 15px;

  font-weight: bold;

  text-transform: uppercase;

  letter-spacing: 0.3px;

}

.location {

  font-size: 9px;

  margin-top: 2px;

}

.report-title {

  font-size: 16px;

  font-weight: bold;

  margin-top: 12px;

  text-transform: uppercase;

  letter-spacing: 0.8px;

}

.report-subtitle {

  font-size: 10px;

  margin-top: 3px;

}


/* =========================================================
   REPORT INFORMATION
   ========================================================= */

.info-table {

  width: 100%;

  border-collapse: collapse;

  margin-top: 8px;

  margin-bottom: 10px;

}

.info-table td {

  border:
    1px solid #999;

  padding: 6px;

}

.info-label {

  width: 18%;

  font-weight: bold;

  background: #f1f1f1;

}


/* =========================================================
   FILTER SECTION
   ========================================================= */

.filter-box {

  border:
    1px solid #999;

  padding: 7px;

  margin-bottom: 12px;

}

.filter-title {

  font-weight: bold;

  margin-bottom: 5px;

}

.filter-row {

  display: flex;

  justify-content: space-between;

}


/* =========================================================
   MAIN TABLE
   ========================================================= */

.records {

  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;

}

.records th {

  background: #e9e9e9;

  border:
    1px solid #555;

  padding: 6px 4px;

  font-size: 8.5px;

  font-weight: bold;

  text-transform: uppercase;

}

.records td {

  border:
    1px solid #999;

  padding: 6px 4px;

  vertical-align: middle;

  font-size: 8.5px;

}

.records tr {

  page-break-inside: avoid;

}

.center {

  text-align: center;

}

.small {

  font-size: 7.5px;

  color: #555;

}


/* =========================================================
   STATUS
   ========================================================= */

.status {

  display: inline-block;

  padding: 3px 5px;

  border-radius: 3px;

  font-size: 7px;

  font-weight: bold;

}

.status-returned {

  background: #d9f2df;

  color: #176b2c;

}

.status-pending {

  background: #fff0c7;

  color: #795600;

}

.status-overdue {

  background: #ffdada;

  color: #a00000;

}

.status-default {

  background: #e7e7e7;

  color: #333;

}


/* =========================================================
   SUMMARY
   ========================================================= */

.summary-title {

  font-size: 11px;

  font-weight: bold;

  margin-top: 15px;

  margin-bottom: 6px;

}

.summary {

  width: 100%;

  border-collapse: collapse;

}

.summary td {

  border:
    1px solid #999;

  padding: 6px;

}

.summary-label {

  font-weight: bold;

  background: #f1f1f1;

}


/* =========================================================
   FOOTER
   ========================================================= */

.footer {

  margin-top: 22px;

  font-size: 8px;

}

.signature {

  margin-top: 45px;

  text-align: right;

}

.signature-line {

  width: 170px;

  border-top:
    1px solid #111;

  margin-left: auto;

  padding-top: 5px;

  text-align: center;

}

.page-footer {

  position: fixed;

  bottom: -8mm;

  left: 0;

  right: 0;

  text-align: center;

  font-size: 7.5px;

  color: #666;

}


/* =========================================================
   PRINT SETTINGS
   ========================================================= */

thead {

  display: table-header-group;

}

tfoot {

  display: table-footer-group;

}

</style>

</head>


<body>


<!-- =====================================================
     HEADER
     ===================================================== -->

<div class="header">

  ${
    logo
      ? `<img src="${logo}" class="logo" />`
      : ''
  }

  <div class="institute">
    MILITARY INSTITUTE OF SCIENCE AND TECHNOLOGY
  </div>

  <div class="location">
    MIRPUR CANTONMENT, DHAKA, BANGLADESH
  </div>

  <div class="report-title">
    Student Outpass Report
  </div>

  <div class="report-subtitle">
  Out Pass Register MIST
  </div>

</div>


<!-- =====================================================
     REPORT INFORMATION
     ===================================================== -->

<table class="info-table">

  <tr>

    <td class="info-label">
      Department
    </td>

    <td>
      ${escapeHtml(department || '—')}
    </td>

    <td class="info-label">
      Generated
    </td>

    <td>
      ${escapeHtml(generatedDate)}
    </td>

  </tr>

  <tr>

    <td class="info-label">
      Total Records
    </td>

    <td>
      ${total}
    </td>

    <td class="info-label">
      Report Type
    </td>

    <td>
      GSO-2 Records
    </td>

  </tr>

</table>


<!-- =====================================================
     FILTERS
     ===================================================== -->

<div class="filter-box">

  <div class="filter-title">
    Applied Filters
  </div>

  <div class="filter-row">

    <span>
      <strong>Status:</strong>
      ${escapeHtml(statusFilter)}
    </span>

    <span>
      <strong>From:</strong>
      ${escapeHtml(dateFrom)}
    </span>

    <span>
      <strong>To:</strong>
      ${escapeHtml(dateTo)}
    </span>

  </div>

</div>


<!-- =====================================================
     RECORDS
     ===================================================== -->

<table class="records">

<thead>

<tr>

  <th style="width: 5%;">
    SL
  </th>

  <th style="width: 18%;">
    Student
  </th>

  <th style="width: 12%;">
    Service No
  </th>

  <th style="width: 12%;">
    Date
  </th>

  <th style="width: 10%;">
    Out
  </th>

  <th style="width: 13%;">
    Return By
  </th>

  <th style="width: 13%;">
    Actual
  </th>

  <th style="width: 17%;">
    Status
  </th>

</tr>

</thead>

<tbody>

  ${
    rows ||
    `
      <tr>
        <td colspan="8" class="center">
          No records found.
        </td>
      </tr>
    `
  }

</tbody>

</table>


<!-- =====================================================
     SUMMARY
     ===================================================== -->

<div class="summary-title">
  Report Summary
</div>

<table class="summary">

<tr>

  <td class="summary-label">
    Total Records
  </td>

  <td>
    ${total}
  </td>

  <td class="summary-label">
    Returned
  </td>

  <td>
    ${returned}
  </td>

</tr>

<tr>

  <td class="summary-label">
    Pending
  </td>

  <td>
    ${pending}
  </td>

  <td class="summary-label">
    Overdue
  </td>

  <td>
    ${overdue}
  </td>

</tr>

</table>


<!-- =====================================================
     FOOTER
     ===================================================== -->

<div class="footer">

  <div>
    This report was generated electronically by
    Out Pass Register MIST.
  </div>

  <div>
    Generated on: ${escapeHtml(generatedDate)}
  </div>

</div>


<div class="signature">

  <div class="signature-line">

    GSO-2 / Authorized Officer

  </div>

</div>


<div class="page-footer">

  MIST Mess Management System &nbsp; | &nbsp;
  Student Outpass Report

</div>


</body>

</html>

`;
};


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function GSO2Records() {

  const { profile } = useAuth();

  const [all, setAll] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refresh, setRefresh] = useState(false);

  const [generating, setGenerating] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: '',
  });


  // ==========================================================
  // FIRESTORE
  // ==========================================================

  useEffect(() => {

    if (!profile) return;

    const q = query(
      collection(db, 'requests'),
      where('dept', '==', profile.dept),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,

      (snap) => {

        setAll(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setLoading(false);

        setRefresh(false);
      },

      (err) => {

        console.warn(
          'Firestore error:',
          err.message
        );

        setLoading(false);

        setRefresh(false);
      }
    );

  }, [profile]);


  // ==========================================================
  // FILTER
  // ==========================================================

  const filtered = useMemo(() => {

    let res = [...all];


    if (filters.search) {

      const s =
        filters.search.toLowerCase();

      res = res.filter(
        r =>
          r.studentName
            ?.toLowerCase()
            .includes(s) ||

          r.serviceNumber
            ?.toLowerCase()
            .includes(s)
      );

    }


    if (filters.status) {

      res = res.filter(
        r =>
          r.status === filters.status
      );

    }


    if (filters.dateFrom) {

      res = res.filter(
        r =>
          r.date >= filters.dateFrom
      );

    }


    if (filters.dateTo) {

      res = res.filter(
        r =>
          r.date <= filters.dateTo
      );

    }


    return res;
  }, [all, filters]);

  // ==========================================================
  // SEPARATE TIMEOUT REQUESTS
  // ==========================================================

  const timeoutRequests = useMemo(() => {
    return filtered.filter(r => r.status === 'timeout');
  }, [filtered]);

  const regularRequests = useMemo(() => {
    return filtered.filter(r => r.status !== 'timeout');
  }, [filtered]);


  // ==========================================================
  // GENERATE PDF
  // ==========================================================
const generatePDF = async () => {
  console.log('========== GENERATE PDF ==========');

  if (!profile) {
    Alert.alert(
      'Error',
      'User profile is not available.'
    );
    return;
  }

  if (filtered.length === 0) {
    Alert.alert(
      'No Records',
      'There are no records matching the current filter.'
    );
    return;
  }

  try {
    setGenerating(true);

    console.log('Creating report HTML...');

    const html = await createReportHTML({
      records: filtered,
      department: profile.dept,
      filters,
    });

    console.log(
      'HTML created:',
      html.length
    );

    // Create a safe filename
    const today = format(
      new Date(),
      'dd-MMM-yyyy'
    );

    const department =
      profile.dept || 'Department';

    const fileName =
      `MIST_Outpass_Report_${department}_${today}.pdf`;

    console.log(
      'Generating PDF:',
      fileName
    );

    const result =
      await PdfGenerator.generateFromHtml({
        html,

        fileName,

        pageSize: PageSize.A4,

        orientation:
          Orientation.Portrait,

        timeout: 60000,
      });

    console.log(
      'PDF generated successfully:',
      result
    );

    console.log(
      'PDF path:',
      result.path
    );

    Alert.alert(
      'PDF Generated',
      `Report generated successfully.\n\n${fileName}`,
      [
        {
          text: 'OK',
        },
      ]
    );

  } catch (error) {

    console.error(
      '========== PDF ERROR =========='
    );

    console.error(error);

    Alert.alert(
      'PDF Generation Error',
      error?.message ||
        String(error) ||
        'Failed to generate PDF.'
    );

  } finally {

    setGenerating(false);

  }
};

  // ==========================================================
  // DIRECT PRINT
  // ==========================================================

const printReport = async () => {
  console.log('========== PRINT REPORT ==========');

  if (!profile) {
    Alert.alert(
      'Error',
      'User profile is not available.'
    );
    return;
  }

  if (filtered.length === 0) {
    Alert.alert(
      'No Records',
      'There are no records matching the current filter.'
    );
    return;
  }

  try {
    setGenerating(true);

    console.log('Creating report HTML...');

    const html = await createReportHTML({
      records: filtered,
      department: profile.dept,
      filters,
    });

    console.log(
      'HTML created:',
      html.length
    );

    console.log(
      'Sending HTML to Android Printer...'
    );

    await Printer.printHtml({
      name: `MIST Outpass Report - ${profile.dept}`,
      html: html,
    });

    console.log(
      'Android print request completed.'
    );

  } catch (error) {

    console.error(
      'PRINT ERROR:',
      error
    );

    Alert.alert(
      'Print Error',
      error?.message ||
        String(error) ||
        'Failed to print the report.'
    );

  } finally {

    setGenerating(false);

  }
};
  // ==========================================================
  // UI
  // ==========================================================

  return (

    <ScrollView

      style={s.screen}

      contentContainerStyle={s.content}

      refreshControl={
        <RefreshControl

          refreshing={refresh}

          onRefresh={() =>
            setRefresh(true)
          }

          tintColor={COLORS.gold}

        />
      }

    >

      <View style={s.titleRow}>

        <View style={{ flex: 1 }}>

          <Text style={s.heading}>
            All Records
          </Text>

          <Text style={s.sub}>
            Dept: {profile?.dept}
            {' · '}
            {filtered.length} of {all.length} records
          </Text>

        </View>


        {/* =================================================
            PRINT BUTTON
            ================================================= */}
          {/* <TouchableOpacity
            style={s.reportButton}
            onPress={generatePDF}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text style={s.reportButtonText}>
                📄 Generate PDF Report
              </Text>
            )}
          </TouchableOpacity> */}
        <TouchableOpacity

          style={[
            s.printButton,
            generating &&
              s.printButtonDisabled,
          ]}

          onPress={printReport}

          disabled={generating}

          activeOpacity={0.8}

        >

          {generating ? (

            <ActivityIndicator
              color="#fff"
              size="small"
            />

          ) : (

            <Text style={s.printButtonText}>
              Print Report
            </Text>

          )}

        </TouchableOpacity>

      </View>


      <FilterBar
        onFilter={setFilters}
      />



      {loading && (

        <ActivityIndicator
          color={COLORS.gold}
          style={{ marginTop: 20 }}
        />

      )}


      {!loading &&
        filtered.length === 0 && (

          <Text style={s.empty}>
            No records match your filter.
          </Text>

        )}


      {/* ===================================================
          REGULAR REQUESTS SECTION
          =================================================== */}

      {regularRequests.length > 0 && (

        <View style={{ marginBottom: 20 }}>

          <Text style={[
            s.heading,
            { marginLeft: 12, marginTop: 10, marginBottom: 10, fontSize: 16, color: '#333' }
          ]}>
            📋 PENDING & PROCESSED
          </Text>

          {regularRequests.map((r) => (

            <View
              key={r.id}
              style={s.card}
            >

              <View style={s.cardHeader}>

                <View style={{ flex: 1 }}>

                  <Text style={s.name}>
                    {r.studentName}
                  </Text>

                  <Text style={s.svc}>

                    {r.serviceNumber}
                    {' · '}
                    {r.rank}
                    {' · '}
                    {fmtDate(r.date)}

                  </Text>

                </View>

                <StatusBadge
                  status={r.status}
                />

              </View>


              <Text
                style={s.cause}
                numberOfLines={2}
              >
                {r.cause}
              </Text>


              <View style={s.times}>

                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    OUT
                  </Text>

                  <Text style={s.timeVal}>
                    {r.outTime}
                  </Text>

                </View>


                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    RETURN BY
                  </Text>

                  <Text style={s.timeVal}>
                    {r.expectedReturn}
                  </Text>

                </View>


                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    ACTUAL
                  </Text>

                  <Text style={s.timeVal}>
                    {r.actualReturn || '—'}
                  </Text>

                </View>

              </View>


              {r.remarks ? (

                <Text style={s.remarks}>
                  Remarks: {r.remarks}
                </Text>

              ) : null}


              {r.arrivalSent && (

                <Text style={s.arrival}>
                  ✓ Arrived at {r.arrivalTime} hrs
                </Text>

              )}

            </View>

          ))}

        </View>

      )}


      {/* ===================================================
          TIMEOUT / TIME OVER REQUESTS SECTION
          =================================================== */}

      {timeoutRequests.length > 0 && (

        <View style={{ marginBottom: 20, borderTopWidth: 2, borderTopColor: '#ff6b6b', paddingTop: 15 }}>

          <Text style={[
            s.heading,
            { marginLeft: 12, marginBottom: 10, fontSize: 16, color: '#ff6b6b' }
          ]}>
            ⏱ TIME OVER / EXPIRED
          </Text>

          <Text style={[
            s.sub,
            { marginLeft: 12, marginBottom: 12, color: '#999', fontSize: 13 }
          ]}>
            {timeoutRequests.length} request(s) expired without approval/rejection
          </Text>

          {timeoutRequests.map((r) => (

            <View
              key={r.id}
              style={[s.card, { borderLeftWidth: 4, borderLeftColor: '#ff6b6b', backgroundColor: '#fff9f9' }]}
            >

              <View style={s.cardHeader}>

                <View style={{ flex: 1 }}>

                  <Text style={s.name}>
                    {r.studentName}
                  </Text>

                  <Text style={s.svc}>

                    {r.serviceNumber}
                    {' · '}
                    {r.rank}
                    {' · '}
                    {fmtDate(r.date)}

                  </Text>

                </View>

                <StatusBadge
                  status={r.status}
                />

              </View>


              <Text
                style={s.cause}
                numberOfLines={2}
              >
                {r.cause}
              </Text>


              <View style={s.times}>

                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    OUT
                  </Text>

                  <Text style={s.timeVal}>
                    {r.outTime}
                  </Text>

                </View>


                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    RETURN BY
                  </Text>

                  <Text style={[s.timeVal, { color: '#ff6b6b', fontWeight: 'bold' }]}>
                    {r.expectedReturn}
                  </Text>

                </View>


                <View style={s.timeItem}>

                  <Text style={s.timeLabel}>
                    ACTUAL
                  </Text>

                  <Text style={s.timeVal}>
                    {r.actualReturn || '—'}
                  </Text>

                </View>

              </View>


              <Text style={[s.remarks, { color: '#ff6b6b', fontStyle: 'italic' }]}>
                ⚠️ Timeout: GSO2 did not respond by {r.expectedReturn} hrs
              </Text>

              {r.remarks && (

                <Text style={s.remarks}>
                  Original Remarks: {r.remarks}
                </Text>

              )}

            </View>

          ))}

        </View>

      )}

    </ScrollView>

  );

}


// ============================================================
// STYLES
// ============================================================

const s = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  heading: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },

  sub: {
    color: COLORS.text2,
    fontSize: 12,
  },

  printButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },

  printButtonDisabled: {
    opacity: 0.6,
  },

  printButtonText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '800',
  },

  reportButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: 'center',
  },

  reportButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },

  pdfButton: {
    backgroundColor: '#2d6a4f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  pdfButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  empty: {
    color: COLORS.text3,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },

  card: {
    backgroundColor: COLORS.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  name: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },

  svc: {
    color: COLORS.text3,
    fontSize: 11,
    marginTop: 2,
  },

  cause: {
    color: COLORS.text2,
    fontSize: 12,
    marginBottom: 10,
  },

  times: {
    flexDirection: 'row',
    gap: 12,
  },

  timeItem: {
    flex: 1,
  },

  timeLabel: {
    color: COLORS.text3,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  timeVal: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  remarks: {
    color: COLORS.amber,
    fontSize: 11,
    marginTop: 8,
  },

  arrival: {
    color: COLORS.green,
    fontSize: 11,
    marginTop: 4,
  },
  reportButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: 'center',
  },

  reportButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },

});